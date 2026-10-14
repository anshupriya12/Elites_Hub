// Homepage, search, price filters, active filters and empty-state tests.
// Real routes, controller, views and CSS run; only the Listing model is faked (in memory, with a small query matcher
// that rejects any unexpected query operator).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;

const state = { queries: [] };
const db = new Map();
const matches = (doc, q) => {
  for (const key of Object.keys(q)) if (!["$or", "price"].includes(key)) throw new Error(`unexpected query key ${key}`);
  if (q.$or && !q.$or.some((c) => Object.entries(c).every(([k, rx]) => rx instanceof RegExp && rx.test(String(doc[k] || ""))))) return false;
  if (q.price) {
    for (const op of Object.keys(q.price)) if (!["$gte", "$lte"].includes(op)) throw new Error(`unexpected operator ${op}`);
    if (q.price.$gte !== undefined && !(doc.price >= q.price.$gte)) return false;
    if (q.price.$lte !== undefined && !(doc.price <= q.price.$lte)) return false;
  }
  return true;
};
class FakeListing {
  constructor(d) { Object.assign(this, d); this._id = new OID(); }
  static find(q = {}) {
    state.queries.push(q);
    let docs = [...db.values()].filter((d) => matches(d, q));
    const chain = {
      sort() { docs.sort((a, b) => String(b._id).localeCompare(String(a._id))); return chain; },
      limit(n) { docs = docs.slice(0, n); return chain; },
      then(res, rej) { return Promise.resolve(docs).then(res, rej); },
    };
    return chain;
  }
}
require.cache[require.resolve("../models/listing.js")] = { id: "l", filename: "l", loaded: true, exports: FakeListing };

const add = (over = {}) => {
  const l = new FakeListing({
    title: "Plain Villa", description: "d", price: 5000, location: "Goa", country: "India",
    image: { url: "/images/demo/x.svg", filename: "demo/x" }, geometry: { type: "Point", coordinates: [1, 2] }, reviews: [], ...over,
  });
  db.set(String(l._id), l);
  return l;
};

const express = require("express");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.static(path.join(ROOT, "public")));
app.use((req, res, next) => { req.flash = () => []; res.locals.success = []; res.locals.error = []; res.locals.currUser = undefined; next(); });
app.use("/", require("../routes/home.js"));
app.use("/listings", require("../routes/listing.js"));
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => { db.clear(); state.queries = []; });

const get = async (url) => { const r = await fetch(base + url); return { status: r.status, text: await r.text() }; };
const cards = (html) => (html.match(/class="listing-link"/g) || []).length;
const titlesInOrder = (html) => [...html.matchAll(/<b>([^<]*)<\/b><br \/>/g)].map((m) => m[1]);

// ---------------- homepage ----------------
test("homepage: hero with Explore Properties and List Your Property buttons and a search box", async () => {
  add();
  const r = await get("/");
  assert.equal(r.status, 200);
  assert.match(r.text, /<h1[^>]*>Find your next stay with Elites Hub<\/h1>/);
  assert.match(r.text, /<a href="\/listings"[^>]*>Explore Properties<\/a>/);
  assert.match(r.text, /<a href="\/listings\/new"[^>]*>List Your Property<\/a>/);
  assert.match(r.text, /<form action="\/listings" method="get"[^>]*role="search"/);
  assert.match(r.text, /<input[^>]*name="q"/);
});

test("homepage: shows at most 6 featured cards, newest first, each with image, title, location, price and a details link", async () => {
  const made = [];
  for (let i = 1; i <= 8; i++) made.push(add({ title: `Villa ${i}`, location: `City ${i}`, price: 1000 * i }));
  const r = await get("/");
  assert.equal(cards(r.text), 6);
  assert.deepEqual(titlesInOrder(r.text), ["Villa 8", "Villa 7", "Villa 6", "Villa 5", "Villa 4", "Villa 3"]);
  assert.ok(r.text.includes("City 8") && r.text.includes("&#8377;8,000/night"));
  assert.ok(r.text.includes(`href="/listings/${made[7]._id}"`));
  assert.match(r.text, /<img\s+src="\/images\/demo\/x\.svg"/);
});

test("homepage: sample listings are badged and explained; real listings are not", async () => {
  add({ title: "Real Home" });
  let r = await get("/");
  assert.ok(!r.text.includes("Sample listing") && !r.text.includes("sample-note"));
  add({ title: "Demo (Sample)", isDemo: true });
  r = await get("/");
  assert.match(r.text, /class="badge bg-warning text-dark sample-badge">Sample listing</);
  assert.match(r.text, /id="sample-note"/);
  assert.match(r.text, /not\s+real\s+properties, are not available for booking, and are not actual offers/);
  assert.equal((r.text.match(/sample-badge/g) || []).length, 1, "only the demo card is badged");
});

test("homepage: with no properties it shows a friendly empty state, not a blank section", async () => {
  const r = await get("/");
  assert.equal(r.status, 200);
  assert.match(r.text, /No properties have been listed yet\./);
  assert.match(r.text, /<a href="\/listings\/new"[^>]*>List Your Property<\/a>/);
  assert.equal(cards(r.text), 0);
});

test("homepage is responsive: viewport meta, stacked buttons on phones, 1/2/3 column grid, mobile CSS", async () => {
  add();
  const r = await get("/");
  assert.match(r.text, /<meta name="viewport" content="width=device-width, initial-scale=1.0">/);
  assert.match(r.text, /flex-column flex-sm-row/);
  assert.match(r.text, /row-cols-1 row-cols-md-2 row-cols-lg-3/);
  const css = fs.readFileSync(path.join(ROOT, "public", "css", "style.css"), "utf8");
  assert.match(css, /@media \(max-width: 575\.98px\)[\s\S]*\.home-hero/);
  assert.match(css, /\.tax-info\s*\{\s*display:\s*none/);
});

test("homepage: a listing without an image and a hostile title render safely", async () => {
  add({ title: "<script>alert(1)</script>", image: undefined });
  const r = await get("/");
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes("<script>alert(1)</script>"));
  assert.ok(r.text.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.match(r.text, />No image</);
});

// ---------------- search and price filters ----------------
const seedSearch = () => {
  add({ title: "Beach Villa", location: "Candolim, Goa", country: "India", price: 8500 });
  add({ title: "Pink Haveli", location: "Amer Road, Jaipur", country: "India", price: 7500 });
  add({ title: "Studio", location: "Zurich", country: "Switzerland", price: 20000 });
  add({ title: "Budget Room", location: "Goa Velha, Goa", country: "India", price: 1200 });
};

test("listings without filters: shows everything and passes an empty query", async () => {
  seedSearch();
  const r = await get("/listings");
  assert.equal(cards(r.text), 4);
  assert.deepEqual(state.queries, [{}]);
  assert.match(r.text, /4 properties found/);
  assert.ok(!r.text.includes("Active filters"));
});

test("search matches location, country and title, case-insensitively", async () => {
  seedSearch();
  assert.equal(cards((await get("/listings?q=GOA")).text), 2);
  assert.equal(cards((await get("/listings?q=switzerland")).text), 1);
  assert.equal(cards((await get("/listings?q=haveli")).text), 1);
  assert.equal(cards((await get("/listings?q=%20%20jaipur%20")).text), 1, "whitespace is trimmed");
});

test("search text is treated literally (regex characters cannot be abused)", async () => {
  add({ title: "abc" });
  add({ title: "a.c" });
  const r = await get("/listings?q=a.c");
  assert.equal(cards(r.text), 1);
  assert.equal((await get("/listings?q=(")).status, 200);
  assert.equal((await get("/listings?q=.*")).status, 200);
});

test("query values that are not plain strings are ignored (no operator injection)", async () => {
  seedSearch();
  let r = await get("/listings?q[$ne]=x&minPrice[$gt]=0");
  assert.equal(r.status, 200);
  assert.equal(cards(r.text), 4);
  assert.deepEqual(state.queries.at(-1), {});
  r = await get("/listings?q=goa&q=jaipur");
  assert.equal(r.status, 200);
  assert.deepEqual(state.queries.at(-1), {});
});

test("very long search text is truncated to 100 characters", async () => {
  seedSearch();
  await get(`/listings?q=${"a".repeat(500)}`);
  assert.equal(state.queries.at(-1).$or[0].location.source.length, 100);
});

test("price filters: minimum, maximum and both, inclusive at the boundaries", async () => {
  seedSearch();
  assert.equal(cards((await get("/listings?minPrice=7500")).text), 3); // 7500, 8500, 20000
  assert.equal(cards((await get("/listings?maxPrice=7500")).text), 2); // 1200, 7500
  const both = await get("/listings?minPrice=7500&maxPrice=8500");
  assert.equal(cards(both.text), 2);
  assert.deepEqual(state.queries.at(-1), { price: { $gte: 7500, $lte: 8500 } });
});

test("search and price filters combine", async () => {
  seedSearch();
  const r = await get("/listings?q=goa&minPrice=5000");
  assert.equal(cards(r.text), 1);
  assert.deepEqual(titlesInOrder(r.text), ["Beach Villa"]);
});

test("invalid prices are ignored with a notice instead of breaking the page", async () => {
  seedSearch();
  let r = await get("/listings?minPrice=abc&maxPrice=-5");
  assert.equal(r.status, 200);
  assert.equal(cards(r.text), 4);
  assert.match(r.text, /The minimum price was not a valid number and was ignored\./);
  assert.match(r.text, /The maximum price was not a valid number and was ignored\./);
  r = await get("/listings?minPrice=1e999");
  assert.match(r.text, /minimum price was not a valid number/);
});

test("minimum above maximum explains the problem and shows the empty state without querying", async () => {
  seedSearch();
  const before = state.queries.length;
  const r = await get("/listings?minPrice=9000&maxPrice=100");
  assert.equal(r.status, 200);
  assert.match(r.text, /The minimum price is higher than the maximum price/);
  assert.match(r.text, /No properties match your search/);
  assert.equal(state.queries.length, before);
});

// ---------------- active filters, form, navbar ----------------
test("active filters are listed with per-filter remove links and a Clear Filters link", async () => {
  seedSearch();
  const r = await get("/listings?q=goa&minPrice=5000&maxPrice=9000");
  assert.match(r.text, /Active filters:/);
  assert.match(r.text, /href="\/listings\?minPrice=5000&amp;maxPrice=9000"[^>]*>Location: goa &times;/);
  assert.match(r.text, /href="\/listings\?q=goa&amp;maxPrice=9000"[^>]*>Min price: ₹5,000 &times;/);
  assert.match(r.text, /href="\/listings\?q=goa&amp;minPrice=5000"[^>]*>Max price: ₹9,000 &times;/);
  assert.match(r.text, /<a href="\/listings" class="small clear-filters">Clear Filters<\/a>/);
});

test("a single active filter's remove link goes back to the plain listings page", async () => {
  seedSearch();
  const r = await get("/listings?q=goa");
  assert.match(r.text, /href="\/listings"[^>]*title="Remove this filter">Location: goa &times;/);
});

test("the filter form keeps the current values and escapes them", async () => {
  seedSearch();
  const r = await get(`/listings?q=${encodeURIComponent('"><script>x</script>')}&minPrice=100&maxPrice=9000`);
  assert.ok(!r.text.includes("<script>x</script>"));
  assert.match(r.text, /<input id="minPrice" name="minPrice" type="number"[^>]*value="100"/);
  assert.match(r.text, /<input id="maxPrice" name="maxPrice" type="number"[^>]*value="9000"/);
  assert.match(r.text, /<input id="q" name="q" type="search"[^>]*value="&#34;&gt;&lt;script&gt;x&lt;\/script&gt;"/);
});

test("the navbar search box now submits to /listings and shows the current search", async () => {
  seedSearch();
  let r = await get("/listings");
  assert.match(r.text, /<form class="d-flex" role="search" action="\/listings" method="get">/);
  assert.match(r.text, /<input[^>]*name="q"[^>]*value=""/);
  r = await get("/listings?q=jaipur");
  assert.match(r.text, /class="form-control me-2 search-input "[\s\S]*?value="jaipur"/);
  r = await get("/");
  assert.match(r.text, /<form class="d-flex" role="search" action="\/listings" method="get">/);
});

// ---------------- empty states ----------------
test("no matches: helpful message, a clear way to reset, and the filter form is still there", async () => {
  seedSearch();
  const r = await get("/listings?q=atlantis");
  assert.equal(r.status, 200);
  assert.equal(cards(r.text), 0);
  assert.match(r.text, /No properties match your search/);
  assert.match(r.text, /Try a different location, widen the price range, or clear your filters/);
  assert.match(r.text, /<a href="\/listings" class="btn add-btn">Clear Filters &amp; Explore All Properties<\/a>/);
  assert.match(r.text, /<input id="q"/);
});

test("no properties at all: invites the visitor to list one (not a blank page)", async () => {
  const r = await get("/listings");
  assert.equal(r.status, 200);
  assert.match(r.text, /No properties have been listed yet/);
  assert.match(r.text, /<a href="\/listings\/new" class="btn add-btn">List Your Property<\/a>/);
});

test("result count wording", async () => {
  add({ title: "Only One", location: "Pune" });
  assert.match((await get("/listings?q=pune")).text, /1 property found/);
});

test("listing cards on the listings page show location and the sample badge", async () => {
  add({ title: "Demo (Sample)", isDemo: true, location: "Udaipur" });
  const r = await get("/listings");
  assert.match(r.text, /sample-badge">Sample listing</);
  assert.ok(r.text.includes("Udaipur"));
});
