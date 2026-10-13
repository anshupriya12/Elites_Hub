const crypto = require("crypto");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 30;

// Parses a strict YYYY-MM-DD string into a UTC-midnight Date, or null if it is not a real date.
const parseDateOnly = (str) => {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== str) return null;
  return d;
};

// Validates the stay and computes the amount (in paise) from the listing's stored nightly price.
module.exports.calculateBooking = ({ price, checkIn, checkOut, now = new Date() }) => {
  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  if (!inDate || !outDate) {
    return { error: "Please enter valid check-in and check-out dates." };
  }
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  if (inDate < today) {
    return { error: "Check-in date cannot be in the past." };
  }
  if (outDate <= inDate) {
    return { error: "Check-out must be after check-in." };
  }
  const nights = Math.round((outDate - inDate) / MS_PER_DAY);
  if (nights > MAX_NIGHTS) {
    return { error: `Stays are limited to ${MAX_NIGHTS} nights.` };
  }
  if (typeof price !== "number" || !isFinite(price) || price <= 0) {
    return { error: "This listing does not have a valid price." };
  }
  const amount = Math.round(price * nights * 100);
  if (amount < 100) {
    return { error: "The booking amount is too small." };
  }
  return { checkIn: inDate, checkOut: outDate, nights, amount };
};

// Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret), hex-encoded.
module.exports.verifySignature = ({ orderId, paymentId, signature, secret }) => {
  if (![orderId, paymentId, signature, secret].every((v) => typeof v === "string" && v)) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports.MAX_NIGHTS = MAX_NIGHTS;
