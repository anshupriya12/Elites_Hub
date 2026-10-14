// Shared navigation, page chrome and links. The real routers, controllers, templates, layout, navbar, footer and
// breadcrumbs run; the Listing/Booking models, Razorpay and Cloudinary are faked in memory.
// Checks: every user-facing page can get back to the homepage, the navbar/footer are shared, the mobile menu markup is
// accessible, no navigation relies on history.back(), and every internal link on every page resolves.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret_for_tests";
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };

const db = new Map();
const OWNER = new OID();
const OTHER = new OID();
const bookings = new Map();
class FakeListing {
  constructor(d) { Object.assign(this, { reviews: [] }, d); this._id = new OID(); }
  set(d) { Object.assign(this, d); }
  async save() { return this; }
  static find(q = {}) {
    let docs = [...db.values()].filter((d) => (!q.$or || q.$or.some((c) => Object.entries(c).every(([k, rx]) => rx.test(String(d[k] || ""))))) && (!q.price || ((q.price.$gte === undefined || d.price >= q.price.$gte) && (q.price.$lte === undefined || d.price <= q.price.$lte))));
    const chain = { sort() { return chain; }, limit(n) { docs = docs.slice(0, n); return chain; }, then(res, rej) { return Promise.resolve(docs).then(res, rej); } };
    return chain;
  }
  static findById(id) { const doc = db.get(String(id)) || null; const p = Promise.resolve(doc); p.populate = () => p; return p; }
}
class FakeBooking {
  constructor(d) { Object.assign(this, { _id: new OID() }, d); }
  async save() { bookings.set(String(this._id), this); return this; }
  static findById(id) {
    const doc = bookings.get(String(id)) || null;
    const p = Promise.resolve(doc);
    p.populate = () => Promise.resolve(doc && Object.assign(doc, { listing: [...db.values()][0] }));
    return p;
  }
}
inject(require.resolve("../models/listing.js"), FakeListing);
inject(require.resolve("../models/booking.js"), FakeBooking);
inject(require.resolve("razorpay"), class { constructor() { this.orders = { create: async (o) => ({ id: "order_X", ...o }) }; } });
inject(require.resolve("cloudinary"), { v2: { config() {}, uploader: { destroy: async () => {} } } });
inject(require.resolve("multer-storage-cloudinary"), { CloudinaryStorage: class { _handleFile(r, f, cb) { f.stream.resume(); cb(new Error("no uploads in this test")); } _removeFile(r, f, cb) { cb(null); } } });

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
  req.logout = (cb) => cb && cb();
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  res.locals.currentPath = req.path;
  next();
});
app.use("/", require("../routes/home.js"));
app.use("/listings", require("../routes/listing.js"));
app.use("/", require("../routes/booking.js"));
app.use("/", require("../routes/user.js"));
app.use("/", require("../routes/google.js"));
// same shape as the real app's 404 + error handlers
app.all("*", (req, res, next) => next(Object.assign(new Error("Page not Found!"), { statusCode: 404 })));
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went Wrong!" } = err;
  res.status(statusCode).render("errors.ejs", { message, status: statusCode, pageTitle: "Error" });
});

let server, base;
let real, demo, booking;
test.before(() => new Promise((resolve) => {
  real = new FakeListing({ title: "Real Home", description: "A real listing", price: 3000, location: "Pune", country: "India", image: { url: "/images/placeholder-property.svg", filename: "x" }, geometry: { type: "Point", coordinates: [1, 2] }, owner: { _id: OWNER, username: "host", equals: (o) => String(o) === String(OWNER) } });
  demo = new FakeListing({ title: "Sample Villa (Sample)", description: "SAMPLE LISTING for demonstration only.", price: 5000, location: "Jaipur", country: "India", image: { url: "/images/demo/jaipur-04.svg", filename: "x" }, geometry: { type: "Point", coordinates: [1, 2] }, isDemo: true });
  db.set(String(real._id), real); db.set(String(demo._id), demo);
  booking = new FakeBooking({ user: OTHER, listing: real._id, checkIn: new Date("2099-01-01"), checkOut: new Date("2099-01-03"), guests: 2, nights: 2, amount: 600000, currency: "INR", razorpayOrderId: "order_X", paymentStatus: "created" });
  bookings.set(String(booking._id), booking);
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

const get = async (url, user) => {
  const res = await fetch(base + url, { redirect: "manual", headers: user ? { "x-user": user } : {} });
  return { status: res.status, loc: res.headers.get("location"), text: await res.text() };
};

// url, who views it, and the breadcrumb trail expected (labels) - null means "no breadcrumb on this page"
const pages = () => [
  { name: "homepage", url: "/", user: null, crumbs: null },
  { name: "all listings", url: "/listings", user: null, crumbs: ["Home", "Properties"] },
  { name: "listings search", url: "/listings?q=Pune&minPrice=100", user: null, crumbs: ["Home", "Properties"] },
  { name: "listings empty state", url: "/listings?q=Atlantis", user: null, crumbs: ["Home", "Properties"] },
  { name: "property detail (real)", url: `/listings/${real._id}`, user: null, crumbs: ["Home", "Properties", "Real Home"] },
  { name: "property detail (sample)", url: `/listings/${demo._id}`, user: "other", crumbs: ["Home", "Properties", "Sample Villa (Sample)"] },
  { name: "create listing", url: "/listings/new", user: "other", crumbs: ["Home", "Properties", "List your property"] },
  { name: "edit listing", url: `/listings/${real._id}/edit`, user: "owner", crumbs: ["Home", "Properties", "Real Home", "Edit"] },
  { name: "log in", url: "/login", user: null, crumbs: ["Home", "Log in"] },
  { name: "sign up", url: "/signup", user: null, crumbs: ["Home", "Sign up"] },
  { name: "booking form", url: `/listings/${real._id}/book`, user: "other", crumbs: ["Home", "Properties", "Real Home", "Book"] },
  { name: "booking details", url: `/bookings/${booking._id}`, user: "other", crumbs: ["Home", "Properties", "Booking"] },
  { name: "404 page", url: "/no-such-page", user: null, crumbs: null, status: 404 },
];

test("every user-facing page has the shared header: brand to /, a visible Home link, Properties and List Your Property", async () => {
  for (const p of pages()) {
    const r = await get(p.url, p.user);
    assert.equal(r.status, p.status || 200, `${p.name} status`);
    assert.match(r.text, /<a class="navbar-brand" href="\/" aria-label="Elites Hub home">/, `${p.name}: brand links to /`);
    assert.match(r.text, /<a class="nav-link[^"]*" href="\/"[^>]*>Home<\/a>/, `${p.name}: Home link`);
    assert.match(r.text, /<a class="nav-link[^"]*" href="\/listings"[^>]*>Properties<\/a>/, `${p.name}: Properties link`);
    assert.match(r.text, /<a class="nav-link[^"]*" href="\/listings\/new"[^>]*>List Your Property<\/a>/, `${p.name}: List link`);
    assert.equal((r.text.match(/<header class="site-header">/g) || []).length, 1, `${p.name}: one shared header`);
    assert.equal((r.text.match(/<footer class="site-footer">/g) || []).length, 1, `${p.name}: one shared footer`);
  }
});

test("page structure: skip link, <main>, one <h1>, language, viewport and a descriptive <title>", async () => {
  for (const p of pages()) {
    const r = await get(p.url, p.user);
    assert.match(r.text, /<html lang="en">/, p.name);
    assert.match(r.text, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/, p.name);
    assert.match(r.text, /<a class="skip-link" href="#main">Skip to main content<\/a>/, p.name);
    assert.match(r.text, /<main id="main" class="container pb-4" tabindex="-1">/, p.name);
    assert.equal((r.text.match(/<h1[\s>]/g) || []).length, 1, `${p.name}: exactly one h1`);
    assert.match(r.text, /<title>[^<]+\| Elites Hub<\/title>|<title>Elites Hub \| Discover properties across India<\/title>/, `${p.name}: title`);
    assert.ok(!/Wanderlust/i.test(r.text), `${p.name}: no leftover Wanderlust branding`);
  }
});

test("deeper pages show a breadcrumb trail that leads back home and to the listings", async () => {
  for (const p of pages().filter((x) => x.crumbs)) {
    const r = await get(p.url, p.user);
    const nav = r.text.match(/<nav aria-label="Breadcrumb">[\s\S]*?<\/nav>/);
    assert.ok(nav, `${p.name}: breadcrumb present`);
    const items = [...nav[0].matchAll(/<li class="breadcrumb-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    assert.deepEqual(items, p.crumbs, `${p.name}: trail`);
    assert.match(nav[0], /<a href="\/">Home<\/a>/, `${p.name}: Home crumb links to /`);
    if (p.crumbs.length > 2) assert.match(nav[0], /<a href="\/listings">Properties<\/a>/, `${p.name}: Properties crumb links to /listings`);
    assert.match(nav[0], /aria-current="page"/, `${p.name}: current page marked`);
  }
});

test("contextual back links exist and are plain links (work when the page is opened directly)", async () => {
  const detail = await get(`/listings/${real._id}`);
  assert.match(detail.text, /<a href="\/listings"[^>]*>&larr; Back to Listings<\/a>/);
  const edit = await get(`/listings/${real._id}/edit`, "owner");
  assert.match(edit.text, new RegExp(`<a href="/listings/${real._id}"[^>]*>&larr; Back to listing</a>`));
  const book = await get(`/listings/${real._id}/book`, "other");
  assert.match(book.text, new RegExp(`<a href="/listings/${real._id}"[^>]*>&larr; Back to property</a>`));
  const done = await get(`/bookings/${booking._id}`, "other");
  assert.match(done.text, /<a href="\/listings"[^>]*>Back to listings<\/a>/);
  assert.match(done.text, /<a href="\/"[^>]*>Back to Home<\/a>/);
  for (const url of ["/login", "/signup"]) assert.match((await get(url)).text, /<a href="\/">Back to Home<\/a>/, url);
  const empty = await get("/listings?q=Atlantis");
  assert.match(empty.text, /<a href="\/listings" class="btn btn-eh">Clear Filters &amp; Explore All Properties<\/a>/);
});

test("error pages always offer a way home and to the listings", async () => {
  const r = await get("/no-such-page");
  assert.equal(r.status, 404);
  assert.match(r.text, /<p class="error-code" aria-hidden="true">404<\/p>/);
  assert.match(r.text, /<h1 id="error-title" class="h3 mb-2">Page not found<\/h1>/);
  assert.match(r.text, /<a href="\/" class="btn btn-eh">Back to Home<\/a>/);
  assert.match(r.text, /<a href="\/listings" class="btn btn-eh-outline">Browse Properties<\/a>/);
});

test("error page wording for 403, 400 and 500", async () => {
  const render = (status, message) => new Promise((resolve, reject) => {
    app.render("errors.ejs", { status, message, pageTitle: "Error", success: [], error: [], currUser: undefined }, (err, html) => (err ? reject(err) : resolve(html)));
  });
  assert.match(await render(403, "Nope"), /You don(?:'|&#39;)t have access to that/);
  assert.match(await render(400, "Bad"), /We couldn(?:'|&#39;)t complete that request/);
  assert.match(await render(500, "Boom"), /Something went wrong/);
  for (const status of [403, 400, 500]) {
    const html = await render(status, "x");
    assert.match(html, /Back to Home/);
    assert.match(html, /Browse Properties/);
  }
});

test("the mobile menu button is accessible and controls the collapsible nav", async () => {
  const r = await get("/");
  assert.match(r.text, /<button\s+class="navbar-toggler"\s+type="button"\s+data-bs-toggle="collapse"\s+data-bs-target="#mainNav"\s+aria-controls="mainNav"\s+aria-expanded="false"\s+aria-label="Toggle navigation menu"\s*>/);
  assert.match(r.text, /<div class="collapse navbar-collapse" id="mainNav">/);
  assert.match(r.text, /<nav class="navbar navbar-expand-lg navbar-eh" aria-label="Main navigation">/);
  assert.match(r.text, /<label class="visually-hidden" for="nav-q">Search properties by city or location<\/label>/);
  assert.match(r.text, /<button class="btn btn-eh" type="submit" aria-label="Search">/);
});

test("the navbar marks the current page and section", async () => {
  const mark = async (url, user) => [...(await get(url, user)).text.matchAll(/<a class="nav-link active" href="([^"]*)"([^>]*)>([^<]*)<\/a>/g)].map((m) => [m[3], m[1], /aria-current="page"/.test(m[2])]);
  assert.deepEqual(await mark("/"), [["Home", "/", true]]);
  assert.deepEqual(await mark("/listings"), [["Properties", "/listings", true]]);
  assert.deepEqual(await mark(`/listings/${real._id}`), [["Properties", "/listings", false]]);
  assert.deepEqual(await mark("/listings/new", "other"), [["List Your Property", "/listings/new", true]]);
  assert.deepEqual(await mark("/login"), [["Log in", "/login", true]]);
  assert.deepEqual(await mark("/signup"), [["Sign up", "/signup", true]]);
});

test("account links: logged out sees Log in / Sign up; logged in sees their name and Log out (header and footer)", async () => {
  for (const url of ["/", "/listings", `/listings/${real._id}`, "/login"]) {
    const out = (await get(url)).text;
    assert.match(out, /<a class="nav-link[^"]*" href="\/login"[^>]*>Log in<\/a>/, url);
    assert.match(out, /<a class="nav-link[^"]*" href="\/signup"[^>]*>Sign up<\/a>/, url);
    assert.ok(!out.includes('href="/logout"'), `${url}: no Log out when logged out`);
    const inn = (await get(url, "other")).text;
    assert.match(inn, /<strong>other<\/strong>/, url);
    assert.equal((inn.match(/href="\/logout"/g) || []).length, 2, `${url}: Log out in header and footer`);
    assert.ok(!/href="\/login"/.test(inn), `${url}: no Log in when logged in`);
  }
});

test("the footer has working links only (no dead # links) and an honest sample-data note", async () => {
  const html = (await get("/")).text;
  const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
  assert.ok(!/href="#"/.test(footer), "no placeholder links");
  for (const href of ["/", "/listings", "/listings/new"]) assert.ok(footer.includes(`href="${href}"`), href);
  assert.match(footer, /fictional examples for demonstration/);
  assert.match(footer, /illustrative stock images/);
  assert.match(footer, new RegExp(`&copy; ${new Date().getFullYear()} Elites Hub`));
  assert.ok(!/premier real estate agency/i.test(footer));
});

test("no template or script relies on history.back() or window.history for navigation", () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : files.push(path.join(dir, e.name))));
  walk(path.join(ROOT, "views"));
  walk(path.join(ROOT, "public", "js"));
  for (const f of files.filter((x) => /\.(ejs|js)$/.test(x))) {
    assert.ok(!/history\.(back|go|forward)\(/.test(fs.readFileSync(f, "utf8")), `${path.basename(f)} must not use history.back()`);
  }
});

test("every internal link and asset on every page resolves (no 404/500)", async () => {
  const checked = new Set();
  const skip = (h) => !h.startsWith("/") || h.startsWith("//") || h.includes("_method=DELETE");
  for (const p of pages()) {
    for (const user of [p.user, "other"]) {
      const page = await get(p.url, user);
      const hrefs = [...page.text.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((h) => !skip(h));
      for (const h of hrefs) {
        if (checked.has(`${user}|${h}`)) continue;
        checked.add(`${user}|${h}`);
        const r = await get(h, user);
        assert.ok(r.status < 400, `${p.name} (${user || "anon"}): ${h} -> ${r.status}`);
      }
    }
  }
  assert.ok(checked.size > 40, `checked ${checked.size} links`);
});

// ---------------- loading state script ----------------
const vm = require("vm");
const UI_SRC = fs.readFileSync(path.join(ROOT, "public", "js", "ui.js"), "utf8");
const runUi = () => {
  const handlers = { form: {}, window: {} };
  const timers = [];
  const btn = { disabled: false, innerHTML: "Search", dataset: { loadingText: "Searching&hellip;" }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const form = { addEventListener: (t, f) => (handlers.form[t] = handlers.form[t] || []).push(f), querySelector: () => btn };
  vm.runInNewContext(UI_SRC, {
    document: { querySelectorAll: (sel) => (sel === "form[data-loading-form]" ? [form] : sel === "button[data-original-html]" ? [btn].filter((b) => b.dataset.originalHtml) : []) },
    window: { addEventListener: (t, f) => (handlers.window[t] = handlers.window[t] || []).push(f) },
    setTimeout: (f) => timers.push(f),
  });
  return { btn, submit: (ev) => handlers.form.submit.forEach((h) => h(ev)), flush: () => timers.splice(0).forEach((f) => f()), pageshow: (persisted) => (handlers.window.pageshow || []).forEach((h) => h({ persisted })) };
};

test("loading state: a valid submit disables the button and shows a spinner; a blocked submit does not; bfcache restores", () => {
  const ok = runUi();
  ok.submit({ defaultPrevented: false });
  ok.flush();
  assert.equal(ok.btn.disabled, true);
  assert.equal(ok.btn.attrs["aria-busy"], "true");
  assert.match(ok.btn.innerHTML, /spinner-border[\s\S]*Searching&hellip;/);
  ok.pageshow(true);
  assert.equal(ok.btn.disabled, false);
  assert.equal(ok.btn.innerHTML, "Search");

  const blocked = runUi();
  blocked.submit({ defaultPrevented: true });
  blocked.flush();
  assert.equal(blocked.btn.disabled, false);
  assert.equal(blocked.btn.innerHTML, "Search");
});

test("the search and create forms opt in to the loading state", async () => {
  const list = (await get("/listings")).text;
  assert.match(list, /<form action="\/listings" method="get" class="search-panel" role="search"[^>]*data-loading-form>/);
  assert.match(list, /<button class="btn btn-eh" type="submit" data-loading-text="Searching&hellip;">Search<\/button>/);
  const create = (await get("/listings/new", "other")).text;
  assert.match(create, /data-loading-form/);
  assert.match(create, /data-loading-text="Adding&hellip;"/);
});
