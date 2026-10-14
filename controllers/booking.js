const Razorpay = require("razorpay");
const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const { bookingSchema } = require("../schema.js");
const { calculateBooking, verifySignature } = require("../utils/bookingUtils.js");

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// Payments run in Test Mode only: keys must be present and the key id must be a test key.
const paymentConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return { error: "Payments are not configured yet." };
  }
  if (!keyId.startsWith("rzp_test_")) {
    return { error: "Only Razorpay Test Mode keys (rzp_test_...) are allowed." };
  }
  return { keyId, keySecret };
};

module.exports.renderBookingForm = async (req, res) => {
  let { id } = req.params;
  const listing = isValidId(id) ? await Listing.findById(id) : null;
  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }
  if (listing.isDemo) {
    req.flash("error", "Sample listings are for demonstration only and cannot be booked.");
    return res.redirect(`/listings/${id}`);
  }
  if (listing.owner && req.user._id && listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing.");
    return res.redirect(`/listings/${id}`);
  }
  res.render("bookings/new.ejs", {
    listing,
    paymentsConfigured: !paymentConfig().error,
  });
};

// Creates a pending booking and a Razorpay order. The amount is always computed here, never taken from the client.
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  if (!req.user._id) {
    return res
      .status(403)
      .json({ error: "Please log in with a username and password account to book." });
  }
  const config = paymentConfig();
  if (config.error) {
    return res.status(503).json({ error: config.error });
  }
  const listing = isValidId(id) ? await Listing.findById(id) : null;
  if (!listing) {
    return res.status(404).json({ error: "Listing does not exist." });
  }
  if (listing.isDemo) {
    return res.status(403).json({ error: "Sample listings are for demonstration only and cannot be booked." });
  }
  if (listing.owner && listing.owner.equals(req.user._id)) {
    return res.status(403).json({ error: "You cannot book your own listing." });
  }

  const { error } = bookingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: "Please check the booking details and try again." });
  }
  const { checkIn, checkOut, guests } = req.body.booking;
  const stay = calculateBooking({ price: listing.price, checkIn, checkOut });
  if (stay.error) {
    return res.status(400).json({ error: stay.error });
  }

  const booking = new Booking({
    user: req.user._id,
    listing: listing._id,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: Number(guests),
    nights: stay.nights,
    amount: stay.amount,
    currency: "INR",
  });

  const razorpay = new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
  let order;
  try {
    order = await razorpay.orders.create({
      amount: booking.amount,
      currency: booking.currency,
      receipt: `booking_${booking._id}`,
      notes: { bookingId: String(booking._id), listingId: String(listing._id) },
    });
  } catch (e) {
    console.error("Razorpay order creation failed:", e && e.statusCode, e && e.error && e.error.description);
    return res.status(502).json({ error: "Could not start the payment. Please try again." });
  }

  booking.razorpayOrderId = order.id;
  await booking.save();

  res.json({
    bookingId: String(booking._id),
    orderId: order.id,
    amount: booking.amount,
    currency: booking.currency,
    keyId: config.keyId,
    description: `${listing.title} (${booking.nights} night${booking.nights > 1 ? "s" : ""})`,
    prefill: { name: req.user.username || "", email: req.user.email || "" },
  });
};

// Verifies the signature on the server before a booking is ever marked paid. Safe to call more than once.
module.exports.verifyPayment = async (req, res) => {
  const { bookingId } = req.params;
  const config = paymentConfig();
  if (config.error) {
    return res.status(503).json({ error: config.error });
  }
  const booking = isValidId(bookingId) ? await Booking.findById(bookingId) : null;
  if (!booking || !booking.user.equals(req.user._id)) {
    return res.status(404).json({ error: "Booking not found." });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const redirect = `/bookings/${booking._id}`;

  // Duplicate verification of an already-paid booking: succeed without changing anything.
  if (booking.paymentStatus === "paid") {
    if (booking.razorpayPaymentId === razorpay_payment_id) {
      return res.json({ status: "paid", redirect });
    }
    return res.status(409).json({ error: "This booking has already been paid." });
  }

  const valid =
    razorpay_order_id === booking.razorpayOrderId &&
    verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      secret: config.keySecret,
    });
  if (!valid) {
    await Booking.findOneAndUpdate(
      { _id: booking._id, paymentStatus: { $ne: "paid" } },
      { $set: { paymentStatus: "failed", failureReason: "Signature verification failed" } }
    );
    return res.status(400).json({ error: "Payment verification failed.", redirect });
  }

  // The status filter makes concurrent duplicate requests safe: only one can flip the booking to paid.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
        paidAt: new Date(),
      },
      $unset: { failureReason: "" },
    },
    { new: true }
  );
  if (!updated) {
    const current = await Booking.findById(bookingId);
    if (current && current.razorpayPaymentId === razorpay_payment_id) {
      return res.json({ status: "paid", redirect });
    }
    return res.status(409).json({ error: "This booking has already been paid." });
  }
  res.json({ status: "paid", redirect });
};

// Records a failed/cancelled attempt reported by Checkout. A paid booking is never downgraded.
module.exports.paymentFailed = async (req, res) => {
  const { bookingId } = req.params;
  const booking = isValidId(bookingId) ? await Booking.findById(bookingId) : null;
  if (!booking || !booking.user.equals(req.user._id)) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const reason =
    typeof req.body.reason === "string" ? req.body.reason.slice(0, 200) : "Payment failed";
  await Booking.findOneAndUpdate(
    { _id: booking._id, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "failed", failureReason: reason } }
  );
  res.json({ status: "recorded", redirect: `/bookings/${booking._id}` });
};

module.exports.showBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = isValidId(bookingId)
    ? await Booking.findById(bookingId).populate("listing", "title location country image")
    : null;
  if (!booking || !booking.user.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }
  res.render("bookings/show.ejs", { booking });
};
