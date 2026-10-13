const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isLoggedInJson } = require("../middleware.js");
const bookingController = require("../controllers/booking.js");

router.get("/listings/:id/book", isLoggedIn, wrapAsync(bookingController.renderBookingForm));

// JSON endpoints used by the Checkout page (fetch).
router.post(
  "/listings/:id/bookings",
  isLoggedInJson,
  wrapAsync(bookingController.createBooking)
);
router.post(
  "/bookings/:bookingId/verify",
  isLoggedInJson,
  wrapAsync(bookingController.verifyPayment)
);
router.post(
  "/bookings/:bookingId/failed",
  isLoggedInJson,
  wrapAsync(bookingController.paymentFailed)
);

router.get("/bookings/:bookingId", isLoggedIn, wrapAsync(bookingController.showBooking));

module.exports = router;
