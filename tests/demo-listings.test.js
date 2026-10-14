// Detail pages and protections for sample (demo) listings: clearly labelled, no owner, not editable, not deletable,
// and not bookable (page hidden and booking endpoints refuse). Real routes, middleware, controllers and views run;
// Listing, Booking and Razorpay are faked (in memory).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret_for_tests";
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };

const state = { saved: 0, deleted: 0, razorpayConstructed: 0, bookingsSaved: 0 };
const db = new Map();
const OWNER = new OID();
const OTHER = new OID();
class FakeListing {
  constructor(d) { Object.assign(this, d); this._id = new OID(); }
  set(d) { Object.assign(this, d); }
  async save() { state.saved++; return this; }
  static findById(id) { const doc = db.get(String(id)) || null; const p = Promise.resolve(doc); p.populate = () => p; return p; }
  static async findByIdAndDelete(id) { state.deleted++; return db.get(String(id)); }
}
class FakeBooking { constructor(d) { Object.assign(this, { _id: new OID() }, d); } async save() { state.bookingsSaved++; return this; } }
inject(require.resolve("../models/listing.js"), FakeListing);
inject(require.resolve("../models/booking.js"), FakeBooking);
inject(require.resolve("razorpay"), class { constructor() { state.razorpayConstructed++; this.orders = { create: async (o) => ({ id: "order_X", ...o }) }; } });
inject(require.resolve("cloudinary"), { v2: { config() {}, uploader: { destroy: async () => {} } } });
inject(require.resolve("multer-storage-cloudinary"), { CloudinaryStorage: class { _handleFile(r, f, cb) { f.stream.resume(); cb(new Error("no uploads in this test")); } _removeFile(r, f, cb) { cb(null); } } });

const demo = () => { const l = new FakeListing({ title: "Candolim Beach Villa (Sample)", description: "SAMPLE LISTING for demonstration only - a bright villa.", price: 8500, location: "Candolim, Goa", country: "India", image: { url: "/images/demo/candolim-beach-villa.svg", filename: "demo/x" }, geometry: { type: "Point", coordinates: [73.7, 15.5] }, reviews: [], isDemo: true, demoKey: "demo-candolim-beach-villa" }); db.set(String(l._id), l); return l; };
const real = () => { const l = new FakeListing({ title: "Real Home", description: "A real listing", price: 3000, location: "Pune", country: "India", image: { url: "https://res.cloudinary.com/x.png", filename: "wanderlust_DEV/x" }, geometry: { type: "Point", coordinates: [1, 2] }, reviews: [], owner: { _id: OWNER, username: "host", equals: (o) => String(o) === String(OWNER) } }); db.set(String(l._id), l); return l; };

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "t", resave: false, saveUninitialized: false }));
app.use(flash());
app.use((req, res, next) => {
  const who = req.headers["x-user"];
  req.user = who ? { _id: who === "owner" ? OWNER : OTHER, username: who } : undefined;
  req.isAuthenticated = () => !!req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});
app.use("/listings", require("../routes/listing.js"));
app.use("/", require("../routes/booking.js"));
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => { db.clear(); Object.assign(state, { saved: 0, deleted: 0, razorpayConstructed: 0, bookingsSaved: 0 }); });

const client = (user) => {
  let sid = "";
  return async (method, url, form) => {
    const res = await fetch(base + url, {
      method, redirect: "manual",
      headers: { ...(user ? { "x-user": user } : {}), ...(sid ? { cookie: sid } : {}), ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: form ? new URLSearchParams(form) : undefined,
    });
    const sc = res.headers.getSetCookie().find((c) => c.startsWith("connect.sid="));
    if (sc) sid = sc.split(";")[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, loc: res.headers.get("location"), text, json };
  };
};

// ---------------- detail page ----------------
test("demo detail page shows image, title, location, country, price, description and a clear sample notice", async () => {
  const l = demo();
  const r = await client("other")("GET", `/listings/${l._id}`);
  assert.equal(r.status, 200);
  for (const expected of ["Candolim Beach Villa (Sample)", "Candolim, Goa", "India", "8,500", "SAMPLE LISTING for demonstration only", "/images/demo/candolim-beach-villa.svg", "Elites Hub (sample listing)"]) {
    assert.ok(r.text.includes(expected), expected);
  }
  assert.match(r.text, /class="sample-notice"/);
  assert.match(r.text, /not real property|It is not a real property/);
  assert.match(r.text, /Back to Listings/);
});

test("demo listings do not offer booking to anyone (logged out, other user)", async () => {
  const l = demo();
  for (const user of [null, "other", "owner"]) {
    const r = await client(user)("GET", `/listings/${l._id}`);
    assert.ok(!r.text.includes(`/listings/${l._id}/book`), `no Book link for ${user}`);
    assert.ok(!/>Book<\/a>/.test(r.text));
    assert.ok(!r.text.includes(">Edit<") && !r.text.includes(">Delete<"), "no edit/delete controls");
  }
});

test("real listings are unchanged: owner shown, Book offered to others, edit/delete only for the owner", async () => {
  const l = real();
  const other = await client("other")("GET", `/listings/${l._id}`);
  assert.match(other.text, /<b>\s*host\s*<\/b>/);
  assert.ok(other.text.includes(`href="/listings/${l._id}/book"`));
  assert.ok(!other.text.includes("sample-notice") && !other.text.includes('class="sample-badge"'));
  assert.ok(!other.text.includes(">Delete<"));
  const owner = await client("owner")("GET", `/listings/${l._id}`);
  assert.ok(owner.text.includes(">Edit<") && owner.text.includes(">Delete<"));
  assert.ok(!owner.text.includes(`/listings/${l._id}/book`));
});

test("a listing with no owner that is not a demo still says owner unavailable", async () => {
  const l = real(); l.owner = undefined;
  const r = await client("other")("GET", `/listings/${l._id}`);
  assert.match(r.text, /Owner unavailable/);
});

// ---------------- edit / delete protection ----------------
test("nobody can open the edit form, save, or delete a demo listing", async () => {
  const l = demo();
  for (const user of ["other", "owner"]) {
    const c = client(user);
    const form = await c("GET", `/listings/${l._id}/edit`);
    assert.equal(form.status, 302);
    assert.equal(form.loc, `/listings/${l._id}`);
    assert.match((await c("GET", form.loc)).text, /Only the owner can edit\/delete the listing/);
    assert.equal((await c("PUT", `/listings/${l._id}`)).status, 302);
    assert.equal((await c("DELETE", `/listings/${l._id}`)).status, 302);
  }
  assert.equal(state.saved, 0);
  assert.equal(state.deleted, 0);
  assert.equal(db.get(String(l._id)).title, "Candolim Beach Villa (Sample)");
});

// ---------------- booking is refused for demo listings ----------------
test("booking page redirects away from a demo listing with an explanation", async () => {
  const l = demo();
  const c = client("other");
  const r = await c("GET", `/listings/${l._id}/book`);
  assert.equal(r.status, 302);
  assert.equal(r.loc, `/listings/${l._id}`);
  assert.match((await c("GET", r.loc)).text, /Sample listings are for demonstration only and cannot be booked\./);
});

test("booking API refuses a demo listing: 403, no booking saved, Razorpay never contacted", async () => {
  const l = demo();
  const r = await client("other")("POST", `/listings/${l._id}/bookings`, { "booking[checkIn]": "2099-01-01", "booking[checkOut]": "2099-01-03", "booking[guests]": "2" });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /cannot be booked/);
  assert.equal(state.bookingsSaved, 0);
  assert.equal(state.razorpayConstructed, 0);
});

test("booking still works for a real listing (regression)", async () => {
  const l = real();
  const r = await client("other")("POST", `/listings/${l._id}/bookings`, { "booking[checkIn]": "2099-01-01", "booking[checkOut]": "2099-01-03", "booking[guests]": "2" });
  assert.equal(r.status, 200);
  assert.equal(r.json.amount, 3000 * 2 * 100);
  assert.equal(state.bookingsSaved, 1);
});
