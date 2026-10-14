// Booking + Razorpay flow tests with in-memory fakes for Mongoose models and the Razorpay SDK. No network, no database.
// Runs as a plain script under `node --test` (exit code 0 = pass).
const path = require("path");
const crypto = require("crypto");
const ROOT = process.argv[2] || path.join(__dirname, "..");
const req_ = (p) => require(path.join(ROOT, p));
const resolve = (p) => require.resolve(path.join(ROOT, p));
const mongoose = req_("node_modules/mongoose");
const OID = mongoose.Types.ObjectId;

const OWNER_ID = new OID();
const USER_ID = new OID();
const OTHER_ID = new OID();
const listingDoc = {
  _id: new OID(), title: "Test Villa", price: 1500, location: "Goa", country: "India",
  owner: OWNER_ID, image: { url: "http://x/y.jpg" },
};

// ---- fakes injected into the require cache ----
const store = new Map();
class Booking {
  constructor(d) { Object.assign(this, { _id: new OID(), paymentStatus: "created", currency: "INR" }, d); }
  async save() { store.set(String(this._id), this); return this; }
}
Booking.findById = (id) => {
  const doc = store.get(String(id)) || null;
  const p = Promise.resolve(doc);
  p.populate = () => Promise.resolve(doc && Object.assign(doc, { listing: listingDoc }));
  return p;
};
Booking.findOneAndUpdate = async (filter, update) => {
  const doc = store.get(String(filter._id));
  if (!doc) return null;
  if (filter.paymentStatus && filter.paymentStatus.$ne === doc.paymentStatus) return null;
  Object.assign(doc, update.$set || {});
  for (const k of Object.keys(update.$unset || {})) delete doc[k];
  return doc;
};
const Listing = { findById: async (id) => (String(id) === String(listingDoc._id) ? listingDoc : null) };
let failOrders = false, orderCounter = 0;
class FakeRazorpay {
  constructor() { this.orders = { create: async (o) => { if (failOrders) throw { statusCode: 500, error: { description: "boom" } }; return { id: "order_T" + ++orderCounter, ...o }; } }; }
}
const inject = (file, exports) => { require.cache[file] = { id: file, filename: file, loaded: true, exports }; };
inject(resolve("models/booking.js"), Booking);
inject(resolve("models/listing.js"), Listing);
inject(require.resolve(path.join(ROOT, "node_modules/razorpay")), FakeRazorpay);

const express = req_("node_modules/express");
const ejsMate = req_("node_modules/ejs-mate");
const bookingRouter = req_("routes/booking.js");

const app = express();
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const who = req.headers["x-user"];
  req.user = who ? { _id: { user: USER_ID, other: OTHER_ID, owner: OWNER_ID }[who], username: who, email: who + "@example.com" } : undefined;
  req.isAuthenticated = () => !!req.user;
  req.session = {};
  req.flash = () => [];
  res.locals.success = []; res.locals.error = []; res.locals.currUser = req.user;
  next();
});
app.use("/", bookingRouter);
app.use((err, req, res, next) => { console.error("UNHANDLED", err); res.status(500).send("err"); });

let pass = 0, fail = 0;
const check = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? "PASS" : "FAIL") + "  " + name + (cond ? "" : "  -> " + JSON.stringify(extra))); };
const SECRET = "unit_test_dummy_secret";
const sign = (o, p, s = SECRET) => crypto.createHmac("sha256", s).update(`${o}|${p}`).digest("hex");
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

(async () => {
  const server = app.listen(0);
  const base = "http://127.0.0.1:" + server.address().port;
  const post = async (url, data, user = "user") => {
    const r = await fetch(base + url, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(user ? { "x-user": user } : {}) }, body: new URLSearchParams(data) });
    let body = null; try { body = await r.json(); } catch (e) {}
    return { status: r.status, body };
  };
  const get = async (url, user = "user") => { const r = await fetch(base + url, { redirect: "manual", headers: user ? { "x-user": user } : {} }); return { status: r.status, text: await r.text(), loc: r.headers.get("location") }; };
  const L = `/listings/${listingDoc._id}`;
  const good = { "booking[checkIn]": day(10), "booking[checkOut]": day(13), "booking[guests]": "2" };

  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  check("no login -> 401 JSON", (await post(L + "/bookings", good, null)).status === 401);
  check("missing keys -> 503", (await post(L + "/bookings", good)).status === 503);
  process.env.RAZORPAY_KEY_ID = "rzp_live_abc"; process.env.RAZORPAY_KEY_SECRET = SECRET;
  check("live key refused -> 503", (await post(L + "/bookings", good)).status === 503);
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";

  const bad = async (name, patch) => check(name, (await post(L + "/bookings", { ...good, ...patch })).status === 400);
  await bad("past check-in rejected", { "booking[checkIn]": day(-2), "booking[checkOut]": day(1) });
  await bad("checkout == checkin rejected", { "booking[checkOut]": day(10) });
  await bad("checkout before checkin rejected", { "booking[checkOut]": day(5) });
  await bad("> 30 nights rejected", { "booking[checkOut]": day(45) });
  await bad("impossible date rejected", { "booking[checkIn]": "2099-02-30", "booking[checkOut]": "2099-03-03" });
  await bad("0 guests rejected", { "booking[guests]": "0" });
  await bad("client-supplied amount rejected (unknown field)", { "booking[amount]": "1" });
  check("invalid listing id -> 404", (await post("/listings/nope/bookings", good)).status === 404);
  check("owner can't book own listing -> 403", (await post(L + "/bookings", good, "owner")).status === 403);

  failOrders = true;
  const before = store.size;
  check("Razorpay order failure -> 502, nothing saved", (await post(L + "/bookings", good)).status === 502 && store.size === before);
  failOrders = false;

  const c = await post(L + "/bookings", good);
  check("create -> 200", c.status === 200, c);
  check("amount computed server-side: 1500 x 3 nights = 450000 paise", c.body && c.body.amount === 450000 && c.body.currency === "INR", c.body);
  check("response exposes only key id, not secret", c.body && c.body.keyId === "rzp_test_dummy" && !JSON.stringify(c.body).includes(SECRET));
  const b = store.get(c.body.bookingId);
  check("booking stored as 'created' with order id", b && b.paymentStatus === "created" && b.razorpayOrderId === c.body.orderId && b.nights === 3 && b.guests === 2);

  const v = (extra, user = "user") => post(`/bookings/${c.body.bookingId}/verify`, extra, user);
  const oid = c.body.orderId;
  check("other user can't verify my booking -> 404", (await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: sign(oid, "pay_1") }, "other")).status === 404);
  check("bad signature -> 400, marked failed", (await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: "deadbeef" })).status === 400 && b.paymentStatus === "failed");
  check("signature signed with wrong secret -> 400", (await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: sign(oid, "pay_1", "other") })).status === 400);
  check("order id mismatch -> 400", (await v({ razorpay_order_id: "order_other", razorpay_payment_id: "pay_1", razorpay_signature: sign("order_other", "pay_1") })).status === 400);
  check("missing fields -> 400", (await v({})).status === 400);
  check("booking not paid after failed attempts", b.paymentStatus !== "paid");

  const ok = await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: sign(oid, "pay_1") });
  check("valid signature after earlier failure (Checkout retry) -> paid", ok.status === 200 && b.paymentStatus === "paid" && b.razorpayPaymentId === "pay_1" && b.paidAt, { ok, s: b.paymentStatus });
  const paidAt = String(b.paidAt);
  const dup = await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: sign(oid, "pay_1") });
  check("duplicate verify -> 200, unchanged", dup.status === 200 && String(b.paidAt) === paidAt);
  check("different payment id after paid -> 409", (await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_2", razorpay_signature: sign(oid, "pay_2") })).status === 409 && b.razorpayPaymentId === "pay_1");
  check("bad signature can't downgrade a paid booking", (await v({ razorpay_order_id: oid, razorpay_payment_id: "pay_1", razorpay_signature: "x" })).status === 200 && b.paymentStatus === "paid");
  await post(`/bookings/${c.body.bookingId}/failed`, { reason: "late failure" });
  check("failure report can't downgrade a paid booking", b.paymentStatus === "paid");

  const c2 = await post(L + "/bookings", good);
  await post(`/bookings/${c2.body.bookingId}/failed`, { reason: "x".repeat(500) });
  const b2 = store.get(c2.body.bookingId);
  check("failure report marks unpaid booking failed, reason truncated", b2.paymentStatus === "failed" && b2.failureReason.length === 200);
  check("invalid booking id on verify -> 404", (await post("/bookings/zzz/verify", {})).status === 404);

  const page = await get(`/bookings/${c.body.bookingId}`);
  check("confirmation page renders for owner", page.status === 200 && page.text.includes("Booking Confirmed") && page.text.includes("Paid") && page.text.includes("Test Villa") && page.text.includes("4,500"), page.text.slice(0, 300));
  check("confirmation page doesn't expose signature/secret", !page.text.includes(SECRET) && !/razorpay_signature/.test(page.text));
  const failedPage = await get(`/bookings/${c2.body.bookingId}`);
  check("failed booking page shows failure", failedPage.status === 200 && failedPage.text.includes("Payment failed"));
  check("other user can't view booking -> redirect", (await get(`/bookings/${c.body.bookingId}`, "other")).status === 302);
  check("booking page requires login -> redirect", (await get(`/bookings/${c.body.bookingId}`, null)).status === 302);

  const form = await get(L + "/book");
  check("booking form renders with keys set", form.status === 200 && form.text.includes("Book Your Stay") && form.text.includes("checkout.razorpay.com/v1/checkout.js") && !form.text.includes("disabled"), form.status);
  check("form has no static payment-button", !form.text.includes("payment-button.js") && !form.text.includes("pl_OKNAGdvmPH0wKc"));
  check("owner redirected from own listing's form", (await get(L + "/book", "owner")).status === 302);
  delete process.env.RAZORPAY_KEY_ID;
  const form2 = await get(L + "/book");
  check("form shows 'not configured' warning and disables pay when keys missing", form2.text.includes("not configured") && form2.text.includes("disabled"));
  check("invalid listing id on form -> redirect", (await get("/listings/nope/book")).status === 302);

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail ? 1 : 0);
})();
