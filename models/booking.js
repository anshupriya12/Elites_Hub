const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
  },
  nights: {
    type: Number,
    required: true,
    min: 1,
  },
  // Amount in the smallest currency unit (paise for INR), calculated on the server.
  amount: {
    type: Number,
    required: true,
    min: 100,
  },
  currency: {
    type: String,
    default: "INR",
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paymentStatus: {
    type: String,
    enum: ["created", "paid", "failed"],
    default: "created",
  },
  failureReason: String,
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
