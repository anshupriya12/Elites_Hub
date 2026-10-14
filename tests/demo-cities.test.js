// The 50-property / 10-city demo dataset and the city search that finds it: Explore Properties, city names, aliases
// (Bangalore/Bengaluru/typo), price-filter combinations, empty states, featured variety, and demo protections.
// Real routes, controllers, middleware, views and the real dataset run; Listing/Booking/Razorpay/Cloudinary are faked.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret_for_tests";
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;
const { buildDemoDocs, NOTICE, cities: demoCities } = require("../init/demoListings.js");
const { cities: aliasCities, resolveCity, cityOfLocation, normalize } = require("../utils/cityAliases.js");

const EXPECTED_CITIES = ["Delhi", "Mumbai", "Kolkata", "Bengaluru", "Chennai", "Hyderabad", "Ahmedabad", "Surat", "Pune", "Jaipur"];
const cityOf = (doc) => doc.location.split(", ").pop();

// ---------------- fakes ----------------
const state = { saved: 0, deleted: 0, razorpay: 0, bookings: 0 };
const db = new Map();
const OWNER = new OID();
const OTHER = new OID();
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
const matches = (doc, q) => {
  for (const key of Object.keys(q)) if (!["$or", "price"].includes(key)) throw new Error(`unexpected query key ${key}`);
  if (q.$or && !q.$or.some((c) => Object.entries(c).every(([k, rx]) => rx instanceof RegExp && rx.test(String(doc[k] || ""))))) return false;
  if (q.price) {
    if (q.price.$gte !== undefined && !(doc.price >= q.price.$gte)) return false;
    if (q.price.$lte !== undefined && !(doc.price <= q.price.$lte)) return false;
  }
  return true;
};
class FakeListing {
  constructor(d) { Object.assign(this, { reviews: [] }, d); this._id = new OID(); }
  set(d) { Object.assign(this, d); }
  async save() { state.saved++; return this; }
  static find(q = {}) {
    let docs = [...db.values()].filter((d) => matches(d, q));
    const chain = {
      sort() { docs.sort((a, b) => String(b._id).localeCompare(String(a._id))); return chain; },
      limit(n) { docs = docs.slice(0, n); return chain; },
      then(res, rej) { return Promise.resolve(docs).then(res, rej); },
    };
    return chain;
  }
  static findById(id) { const doc = db.get(String(id)) || null; const p = Promise.resolve(doc); p.populate = () => p; return p; }
  static async findByIdAndDelete(id) { state.deleted++; return db.get(String(id)); }
}
class FakeBooking { constructor(d) { Object.assign(this, { _id: new OID() }, d); } async save() { state.bookings++; return this; } }
inject(require.resolve("../models/listing.js"), FakeListing);
inject(require.resolve("../models/booking.js"), FakeBooking);
inject(require.resolve("razorpay"), class { constructor() { state.razorpay++; this.orders = { create: async (o) => ({ id: "order_X", ...o }) }; } });
inject(require.resolve("cloudinary"), { v2: { config() {}, uploader: { destroy: async () => {} } } });
inject(require.resolve("multer-storage-cloudinary"), { CloudinaryStorage: class { _handleFile(r, f, cb) { f.stream.resume(); cb(new Error("no uploads in this test")); } _removeFile(r, f, cb) { cb(null); } } });

// All 50 demo records, inserted city by city (so "newest first" alone would show only one city), plus one user listing.
let userListing;
const load = () => {
  db.clear();
  const docs = buildDemoDocs().sort((a, b) => EXPECTED_CITIES.indexOf(cityOf(a)) - EXPECTED_CITIES.indexOf(cityOf(b)) || a.demoKey.localeCompare(b.demoKey));
  for (const d of docs) { const l = new FakeListing(d); db.set(String(l._id), l); }
  userListing = new FakeListing({ title: "Rohit's Family Flat", description: "Real listing", price: 3200, location: "Whitefield, Bangalore", country: "India", image: { url: "https://res.cloudinary.com/x.png", filename: "wanderlust_DEV/x" }, geometry: { type: "Point", coordinates: [77.7, 12.9] }, owner: { _id: OWNER, username: "rohit", equals: (o) => String(o) === String(OWNER) } });
  db.set(String(userListing._id), userListing);
};

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.static(path.join(ROOT, "public")));
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
app.use("/", require("../routes/home.js"));
app.use("/listings", require("../routes/listing.js"));
app.use("/", require("../routes/booking.js"));
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => { load(); Object.assign(state, { saved: 0, deleted: 0, razorpay: 0, bookings: 0 }); });

const send = async (method, url, { user, form } = {}) => {
  const res = await fetch(base + url, {
    method, redirect: "manual",
    headers: { ...(user ? { "x-user": user } : {}), ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, loc: res.headers.get("location") };
};
const get = (url, user) => send("GET", url, { user });
const cards = (html) => (html.match(/class="listing-link"/g) || []).length;
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&#34;|&quot;/g, '"').replace(/&amp;/g, "&");
const cardTitles = (html) => [...html.matchAll(/<h3 class="property-card__title">([^<]*)<\/h3>/g)].map((m) => decode(m[1]));
const demoByCity = (city) => buildDemoDocs().filter((d) => cityOf(d) === city);

// ---------------- dataset ----------------
test("dataset: exactly the 10 target cities, 5 unique sample properties in each", () => {
  assert.deepEqual(demoCities.map((c) => c.name), EXPECTED_CITIES);
  const docs = buildDemoDocs();
  assert.equal(docs.length, 50);
  for (const city of EXPECTED_CITIES) {
    const list = demoByCity(city);
    assert.equal(list.length, 5, city);
    assert.equal(new Set(list.map((d) => d.title)).size, 5, `${city}: unique titles`);
    assert.equal(new Set(list.map((d) => d.location)).size, 5, `${city}: distinct localities`);
    assert.equal(new Set(list.map((d) => d.description)).size, 5, `${city}: unique descriptions`);
  }
  assert.equal(new Set(docs.map((d) => d.title)).size, 50);
  assert.deepEqual([...new Set(docs.map(cityOf))].sort(), [...EXPECTED_CITIES].sort(), "no other cities");
});

test("dataset: every record has a stable demoKey and the demo marker, no owner, a clear sample label", () => {
  const docs = buildDemoDocs();
  const expectedKeys = [];
  for (const c of demoCities) for (let n = 1; n <= 5; n++) expectedKeys.push(`demo-${c.slug}-0${n}`);
  assert.deepEqual(docs.map((d) => d.demoKey).sort(), expectedKeys.sort(), "keys follow demo-<city>-0N and never change");
  for (const d of docs) {
    assert.equal(d.isDemo, true);
    assert.ok(!("owner" in d));
    assert.ok(d.title.endsWith("(Sample)"));
    assert.ok(d.description.startsWith(NOTICE));
    assert.equal(d.country, "India");
    assert.ok(Number.isInteger(d.price) && d.price >= 2000 && d.price <= 30000, `${d.title} price ${d.price}`);
  }
});

// ---------------- Explore Properties ----------------
test("Explore Properties on the homepage points to /listings, which lists demo properties by default", async () => {
  const home = await get("/");
  assert.match(home.text, /<a href="\/listings"[^>]*>Explore Properties<\/a>/);
  const href = home.text.match(/<a href="([^"]*)"[^>]*>Explore Properties<\/a>/)[1];
  assert.equal(href, "/listings");
  const page = await get(href);
  assert.equal(page.status, 200);
  assert.match(page.text, /51 properties found/);
  assert.equal(cards(page.text), 51);
  assert.equal((page.text.match(/sample-badge">Sample listing</g) || []).length, 50, "demo cards are badged");
  assert.match(page.text, /<input id="q" name="q" type="search"/);
});

test("List Your Property still goes to /listings/new (and requires login, as before)", async () => {
  const home = await get("/");
  assert.match(home.text, /<a href="\/listings\/new"[^>]*>List Your Property<\/a>/);
  assert.equal((await get("/listings/new")).status, 302);
  assert.equal((await get("/listings/new", "other")).status, 200);
});

// ---------------- city search ----------------
test("searching each of the 10 cities returns exactly its 5 sample properties", async () => {
  for (const city of EXPECTED_CITIES) {
    const r = await get(`/listings?q=${encodeURIComponent(city)}`);
    const want = demoByCity(city).map((d) => d.title).sort();
    const got = cardTitles(r.text).filter((t) => t.endsWith("(Sample)")).sort();
    assert.deepEqual(got, want, city);
    assert.match(r.text, new RegExp(`${city === "Bengaluru" ? "6" : "5"} propert(y|ies) found`), `${city} count`);
  }
});

test("search is case-insensitive and ignores leading/trailing spaces", async () => {
  for (const city of EXPECTED_CITIES) {
    for (const term of [city.toLowerCase(), city.toUpperCase(), `   ${city}   `, ` ${city.toLowerCase()}`]) {
      const r = await get(`/listings?q=${encodeURIComponent(term)}`);
      const sample = cardTitles(r.text).filter((t) => t.endsWith("(Sample)"));
      assert.equal(sample.length, 5, `"${term}"`);
    }
  }
});

test("Bangalore, Bengaluru and the typo 'Banglaore' all find the Bengaluru properties (including a user listing saved as Bangalore)", async () => {
  const want = [...demoByCity("Bengaluru").map((d) => d.title), "Rohit's Family Flat"].sort();
  for (const term of ["Bangalore", "Bengaluru", "Banglaore", "banglore", "  BANGALORE  ", "bangalore, india", "Bengalooru"]) {
    const r = await get(`/listings?q=${encodeURIComponent(term)}`);
    assert.equal(r.status, 200, term);
    assert.deepEqual(cardTitles(r.text).sort(), want, term);
  }
});

test("'Showing results for' explains an alias, and is absent when the canonical name is typed", async () => {
  assert.match((await get("/listings?q=Bangalore")).text, /Showing results for <b>Bengaluru<\/b>/);
  assert.match((await get("/listings?q=Banglaore")).text, /Showing results for <b>Bengaluru<\/b>/);
  assert.ok(!(await get("/listings?q=Bengaluru")).text.includes("Showing results for"));
  assert.ok(!(await get("/listings?q=goa")).text.includes("Showing results for"));
});

test("other common names map to the right city (Madras, Bombay, Calcutta, New Delhi, Poona, Ahmadabad, Hydrabad)", async () => {
  for (const [term, city] of [["Madras", "Chennai"], ["Bombay", "Mumbai"], ["Calcutta", "Kolkata"], ["New Delhi", "Delhi"], ["Poona", "Pune"], ["Ahmadabad", "Ahmedabad"], ["Hydrabad", "Hyderabad"], ["Jaypur", "Jaipur"], ["Suart", "Surat"]]) {
    const r = await get(`/listings?q=${encodeURIComponent(term)}`);
    const got = cardTitles(r.text).sort();
    assert.deepEqual(got, demoByCity(city).map((d) => d.title).sort(), `${term} -> ${city}`);
  }
});

test("aliases are explicit, not fuzzy: unknown spellings find nothing and whole-word matching avoids look-alikes", async () => {
  for (const term of ["Banglaor", "Mumbbai", "Dilhi", "Hydrbd"]) {
    const r = await get(`/listings?q=${encodeURIComponent(term)}`);
    assert.equal(cards(r.text), 0, term);
    assert.match(r.text, /No properties match your search/);
  }
  const lookalike = new FakeListing({ title: "Desert Camp", description: "d", price: 3000, location: "Suratgarh, Rajasthan", country: "India", image: { url: "/x.svg" }, geometry: { type: "Point", coordinates: [1, 2] } });
  db.set(String(lookalike._id), lookalike);
  const surat = cardTitles((await get("/listings?q=Surat")).text);
  assert.equal(surat.length, 5);
  assert.ok(!surat.includes("Desert Camp"), "Suratgarh is not Surat");
});

test("alias helpers: normalization and resolution", () => {
  assert.equal(normalize("  Béngalûru!! "), "bengaluru");
  assert.equal(resolveCity("BANGALORE").name, "Bengaluru");
  assert.equal(resolveCity("bangalore, karnataka").name, "Bengaluru");
  assert.equal(resolveCity("Goa"), null);
  assert.equal(resolveCity(""), null);
  assert.equal(cityOfLocation("Koramangala, Bangalore"), "Bengaluru");
  assert.equal(cityOfLocation("Jubilee Hills, Hyderabad"), "Hyderabad");
  assert.equal(cityOfLocation("Goa"), null);
  assert.deepEqual(aliasCities.map((c) => c.name), EXPECTED_CITIES);
  const seen = new Map();
  for (const c of aliasCities) for (const a of c.aliases) { assert.ok(!seen.has(normalize(a)), `alias ${a} is unique`); seen.set(normalize(a), c.name); }
});

// ---------------- price filters combine with location ----------------
test("city + minimum/maximum price combine correctly (also through an alias)", async () => {
  const bengaluru = demoByCity("Bengaluru");
  const prices = (list) => list.map((d) => d.title).sort();
  const min = await get("/listings?q=Bengaluru&minPrice=7000");
  assert.deepEqual(cardTitles(min.text).filter((t) => t.endsWith("(Sample)")).sort(), prices(bengaluru.filter((d) => d.price >= 7000)));
  const max = await get("/listings?q=Bengaluru&maxPrice=7000");
  assert.deepEqual(cardTitles(max.text).filter((t) => t.endsWith("(Sample)")).sort(), prices(bengaluru.filter((d) => d.price <= 7000)));
  const both = await get("/listings?q=Bangalore&minPrice=6000&maxPrice=9000");
  const wantBoth = bengaluru.filter((d) => d.price >= 6000 && d.price <= 9000).map((d) => d.title);
  if (userListing.price >= 6000 && userListing.price <= 9000) wantBoth.push(userListing.title);
  assert.deepEqual(cardTitles(both.text).sort(), wantBoth.sort());
  assert.ok(wantBoth.length > 0 && wantBoth.length < 6, "the range really narrows the results");
  assert.match(both.text, /Location: Bangalore &times;/);
  assert.match(both.text, /Min price: ₹6,000 &times;/);
  assert.match(both.text, /Max price: ₹9,000 &times;/);
});

test("price filters alone still work across all demo cities", async () => {
  const docs = buildDemoDocs();
  const r = await get("/listings?minPrice=20000");
  assert.deepEqual(cardTitles(r.text).sort(), docs.filter((d) => d.price >= 20000).map((d) => d.title).sort());
});

// ---------------- empty state and Clear Filters ----------------
test("no match: useful empty state with a Clear Filters button that restores every property", async () => {
  const empty = await get("/listings?q=Atlantis");
  assert.equal(empty.status, 200);
  assert.equal(cards(empty.text), 0);
  assert.match(empty.text, /No properties match your search/);
  const href = empty.text.match(/<a href="([^"]*)" class="btn btn-eh">Clear Filters &amp; Explore All Properties<\/a>/)[1];
  assert.equal(href, "/listings");
  assert.equal(cards((await get(href)).text), 51);
  assert.match(empty.text, /<a href="\/listings" class="small clear-filters">Clear Filters<\/a>/);
});

test("a real city with a price range that excludes everything shows the empty state with both chips", async () => {
  const r = await get("/listings?q=Delhi&maxPrice=100");
  assert.match(r.text, /No properties match your search/);
  assert.match(r.text, /Location: Delhi &times;/);
  assert.match(r.text, /Max price: ₹100 &times;/);
});

test("removing one chip keeps the other filter; Clear Filters removes all", async () => {
  const r = await get("/listings?q=Pune&minPrice=5000");
  assert.match(r.text, /href="\/listings\?minPrice=5000"[^>]*>Location: Pune &times;/);
  assert.match(r.text, /href="\/listings\?q=Pune"[^>]*>Min price: ₹5,000 &times;/);
  const puneAll = (await get("/listings?q=Pune")).text;
  assert.equal(cards(puneAll), 5);
  assert.ok(cards(r.text) < 5 && cards(r.text) > 0);
});

test("the Popular cities links search each city", async () => {
  const page = (await get("/listings")).text;
  const links = [...page.matchAll(/<a class="chip" href="([^"]*)">([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links.map((l) => l[1]), EXPECTED_CITIES);
  for (const [href, name] of links) {
    assert.equal(href, `/listings?q=${name}`);
    const r = await get(href);
    assert.equal(cardTitles(r.text).filter((t) => t.endsWith("(Sample)")).length, 5, name);
  }
});

test("the navbar and homepage search boxes submit to /listings with name=q", async () => {
  for (const url of ["/", "/listings"]) {
    const html = (await get(url)).text;
    assert.match(html, /<form[^>]*role="search"[^>]*action="\/listings" method="get"|<form action="\/listings" method="get"[^>]*role="search"/);
    assert.match(html, /<input[^>]*name="q"/);
  }
});

// ---------------- cards, homepage variety ----------------
test("cards show image, title, city and price with a details link and the sample badge", async () => {
  const r = await get("/listings?q=Jaipur");
  const d = demoByCity("Jaipur")[0];
  assert.ok(r.text.includes(d.title) && r.text.includes(d.location));
  assert.ok(r.text.includes(`src="${d.image.url}"`));
  assert.ok(r.text.includes(`&#8377;${d.price.toLocaleString("en-IN")}</strong>`));
  assert.equal((r.text.match(/href="\/listings\/[0-9a-f]{24}" class="listing-link"/g) || []).length, 5);
  assert.equal((r.text.match(/sample-badge">Sample listing</g) || []).length, 5);
});

test("homepage featured cards are spread across different cities, not one city", async () => {
  const home = await get("/");
  assert.equal(cards(home.text), 6);
  const titles = cardTitles(home.text);
  const byTitle = new Map([...db.values()].map((l) => [l.title, l]));
  const featuredCities = titles.map((t) => cityOfLocation(byTitle.get(t).location));
  assert.equal(new Set(featuredCities).size, 6, `cities: ${featuredCities.join(", ")}`);
  assert.match(home.text, /id="sample-note"/);
});

// ---------------- demo properties are protected ----------------
test("every demo property page shows image, location, price, description and a sample label, and offers no booking", async () => {
  for (const l of [...db.values()].filter((x) => x.isDemo)) {
    const r = await get(`/listings/${l._id}`, "other");
    assert.equal(r.status, 200, l.title);
    for (const expected of [l.title, l.location, "India", l.description.split(" - ")[0].slice(0, 20), `src="${l.image.url}"`, "Sample listing.", "&#8377;", l.price.toLocaleString("en-IN")]) {
      assert.ok(r.text.includes(expected), `${l.title}: ${expected}`);
    }
    assert.ok(!r.text.includes(`/listings/${l._id}/book`) && !/>Book<\/a>/.test(r.text), `${l.title}: no Book`);
    assert.ok(!r.text.includes(">Edit<") && !r.text.includes(">Delete<"));
  }
});

test("demo properties cannot be edited, deleted or booked, even with hand-crafted requests", async () => {
  const demos = [...db.values()].filter((x) => x.isDemo);
  const sample = EXPECTED_CITIES.map((c) => demos.find((l) => cityOf(l) === c));
  for (const l of sample) {
    for (const user of ["other", "owner"]) {
      assert.equal((await get(`/listings/${l._id}/edit`, user)).status, 302, "edit form blocked");
      assert.equal((await send("PUT", `/listings/${l._id}`, { user })).status, 302, "update blocked");
      assert.equal((await send("DELETE", `/listings/${l._id}`, { user })).status, 302, "delete blocked");
    }
    assert.equal((await get(`/listings/${l._id}/book`, "other")).status, 302, "booking page blocked");
    const crafted = await send("POST", `/listings/${l._id}/bookings`, { user: "other", form: { "booking[checkIn]": "2099-01-01", "booking[checkOut]": "2099-01-03", "booking[guests]": "2" } });
    assert.equal(crafted.status, 403);
    assert.match(crafted.json.error, /cannot be booked/);
  }
  assert.equal(state.saved, 0);
  assert.equal(state.deleted, 0);
  assert.equal(state.bookings, 0);
  assert.equal(state.razorpay, 0, "the payment provider is never contacted for sample listings");
});

test("a user's own listing keeps working: owner can edit, others can book it, search finds it", async () => {
  assert.equal((await get(`/listings/${userListing._id}/edit`, "owner")).status, 200);
  const page = await get(`/listings/${userListing._id}`, "other");
  assert.ok(page.text.includes(`/listings/${userListing._id}/book`));
  assert.ok(!page.text.includes('class="sample-badge"') && !page.text.includes("sample-notice"));
  const crafted = await send("POST", `/listings/${userListing._id}/bookings`, { user: "other", form: { "booking[checkIn]": "2099-01-01", "booking[checkOut]": "2099-01-03", "booking[guests]": "2" } });
  assert.equal(crafted.status, 200);
  assert.equal(crafted.json.amount, 3200 * 2 * 100);
});
