// Property photographs: provenance manifest, file validity, mapping from the old illustration URLs, and how pages use them
// (local files only, alt text, a fallback, consistent 4:3 cropping). Nothing here touches the network or a database.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const { photos, urlFor, LICENSE, LICENSE_URL } = require("../init/demoPhotos.js");
const { demoListings, buildDemoDocs } = require("../init/demoListings.js");
const { legacyDemoListings } = require("../init/legacyDemo.js");
const { resolvePropertyImage, PLACEHOLDER } = require("../utils/propertyImages.js");

const photosDir = path.join(ROOT, "public", "images", "properties");

// width/height from the JPEG start-of-frame marker
const jpegSize = (buf) => {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
};

// ---------------- manifest ----------------
test("manifest: one photo for each of the 50 demo listings, with credit, licence and meaningful alt text", () => {
  assert.deepEqual(Object.keys(photos).sort(), demoListings.map((d) => d.slug).sort());
  assert.equal(LICENSE, "Unsplash License");
  assert.equal(LICENSE_URL, "https://unsplash.com/license");
  for (const [slug, p] of Object.entries(photos)) {
    assert.match(p.unsplashId, /^\d{10,13}-[0-9a-f]{12}$/, `${slug} id`);
    assert.ok(p.photographer && p.photographer.length > 1, `${slug} photographer`);
    assert.ok(p.alt.length >= 25 && p.alt.length <= 120, `${slug} alt length`);
    assert.ok(!/^photo$|^image$/i.test(p.alt), `${slug} alt is descriptive`);
    assert.equal(urlFor(slug), `/images/properties/${slug}.jpg`);
  }
  assert.equal(new Set(Object.values(photos).map((p) => p.unsplashId)).size, 50, "no photo is used twice");
  assert.equal(new Set(Object.values(photos).map((p) => p.alt)).size, 50, "every alt text is different");
});

test("manifest: photos were chosen from pre-2023 uploads (genuine photography, not AI/rendered images)", () => {
  for (const [slug, p] of Object.entries(photos)) {
    assert.ok(Number(p.unsplashId.split("-")[0]) < 1672531200000, `${slug} uploaded before 2023`);
  }
});

test("photo kinds match the listing type (villa listings use villa-style photos, etc. are spot-checked by description)", () => {
  const byKind = (k) => demoListings.filter((d) => d.kind === k).map((d) => photos[d.slug].alt.toLowerCase());
  for (const alt of byKind("villa")) assert.match(alt, /villa|pool|house|bungalow|porch|terrace/, alt);
  for (const alt of byKind("haveli")) assert.match(alt, /haveli|traditional|heritage|carved/, alt);
  for (const alt of byKind("townhouse")) assert.match(alt, /townhouse|brick/, alt);
  for (const alt of byKind("penthouse")) assert.match(alt, /terrace|rooftop/, alt);
  for (const alt of byKind("farmhouse")) assert.match(alt, /farmhouse|farm|veranda|fields/, alt);
});

// ---------------- files ----------------
test("files: 50 real, optimized, local JPEGs at a consistent 4:3 size, all different", () => {
  const names = fs.readdirSync(photosDir).sort();
  assert.deepEqual(names, demoListings.map((d) => `${d.slug}.jpg`).sort());
  let total = 0;
  const hashes = new Set();
  for (const name of names) {
    const buf = fs.readFileSync(path.join(photosDir, name));
    total += buf.length;
    assert.deepEqual([...buf.subarray(0, 3)], [0xff, 0xd8, 0xff], `${name} is a JPEG`);
    assert.ok(buf.length >= 40 * 1024 && buf.length <= 250 * 1024, `${name} size ${buf.length}`);
    assert.deepEqual(jpegSize(buf), { width: 900, height: 675 }, `${name} dimensions`);
    hashes.add(crypto.createHash("sha1").update(buf).digest("hex"));
  }
  assert.equal(hashes.size, 50, "no two files are identical");
  assert.ok(total < 8 * 1024 * 1024, `total ${(total / 1048576).toFixed(1)} MB stays within the repository budget`);
});

test("seed data now points at the photographs, never at the old illustrations", () => {
  for (const d of buildDemoDocs()) {
    assert.equal(d.image.url, urlFor(d.demoKey.replace("demo-", "")));
    assert.ok(!d.image.url.endsWith(".svg"));
  }
});

test("placeholder image exists for failed or missing photos", () => {
  const svg = fs.readFileSync(path.join(ROOT, "public", PLACEHOLDER), "utf8");
  assert.match(svg, /^<svg[\s\S]*Photo unavailable/);
});

test("the photo download script only fetches from the manifest and validates what it saves", () => {
  const src = fs.readFileSync(path.join(ROOT, "init", "downloadDemoPhotos.js"), "utf8");
  assert.match(src, /require\("\.\/demoPhotos\.js"\)/);
  assert.match(src, /images\.unsplash\.com\/photo-\$\{p\.unsplashId\}\?w=900&h=675/);
  assert.match(src, /isJpeg\(buf\)/);
  assert.ok(!/mongoose|ATLASDB|\.env/.test(src), "no database or secrets access");
});

// ---------------- resolver ----------------
test("resolver: sample listings stored with the old illustration URL show the matching photograph (no database change needed)", () => {
  const stored = { isDemo: true, title: "Delhi flat (Sample)", image: { url: "/images/demo/delhi-01.svg" } };
  const r = resolvePropertyImage(stored);
  assert.equal(r.src, "/images/properties/delhi-01.jpg");
  assert.equal(r.credit, photos["delhi-01"].photographer);
  assert.equal(r.illustrative, true);
  assert.match(r.alt, /does not show the actual property/);
  assert.ok(r.alt.includes(photos["delhi-01"].alt));
  // already-migrated records resolve to the same file
  assert.equal(resolvePropertyImage({ isDemo: true, title: "x", image: { url: "/images/properties/delhi-01.jpg" } }).src, "/images/properties/delhi-01.jpg");
  // all 50 old-style URLs map to existing files
  for (const d of demoListings) {
    const res = resolvePropertyImage({ isDemo: true, title: d.title, image: { url: `/images/demo/${d.slug}.svg` } });
    assert.ok(fs.existsSync(path.join(ROOT, "public", res.src)), res.src);
  }
});

test("resolver: user listings are shown exactly as stored, even if the URL looks like a demo URL", () => {
  assert.equal(resolvePropertyImage({ isDemo: false, title: "Mine", image: { url: "https://res.cloudinary.com/x/y.jpg" } }).src, "https://res.cloudinary.com/x/y.jpg");
  const fake = resolvePropertyImage({ title: "Mine", image: { url: "/images/demo/delhi-01.svg" } });
  assert.equal(fake.src, "/images/demo/delhi-01.svg", "not a demo listing: untouched");
  assert.equal(fake.illustrative, false);
  assert.equal(fake.alt, "Photo of Mine");
  assert.equal(fake.credit, null);
});

test("resolver: first-version (legacy) sample records keep their stored illustration; missing images get the placeholder", () => {
  const legacy = legacyDemoListings[0];
  assert.equal(resolvePropertyImage({ isDemo: true, title: "Old", image: { url: `/images/demo/${legacy.slug}.svg` } }).src, `/images/demo/${legacy.slug}.svg`);
  assert.equal(resolvePropertyImage({ title: "No picture" }).src, PLACEHOLDER);
  assert.equal(resolvePropertyImage({ title: "No picture", image: {} }).src, PLACEHOLDER);
  assert.equal(resolvePropertyImage(null).src, PLACEHOLDER);
});

// ---------------- how pages use them ----------------
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
const db = new Map();
class FakeListing {
  constructor(d) { Object.assign(this, { reviews: [] }, d); this._id = new mongoose.Types.ObjectId(); }
  static find() { let docs = [...db.values()]; const ch = { sort() { return ch; }, limit(n) { docs = docs.slice(0, n); return ch; }, then(a, b) { return Promise.resolve(docs).then(a, b); } }; return ch; }
  static findById(id) { const d = db.get(String(id)) || null; const p = Promise.resolve(d); p.populate = () => p; return p; }
}
const mongoose = require("mongoose");
inject(require.resolve("../models/listing.js"), FakeListing);
inject(require.resolve("cloudinary"), { v2: { config() {}, uploader: { destroy: async () => {} } } });
inject(require.resolve("multer-storage-cloudinary"), { CloudinaryStorage: class { _handleFile(r, f, cb) { f.stream.resume(); cb(new Error("x")); } _removeFile(r, f, cb) { cb(null); } } });
const express = require("express");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.static(path.join(ROOT, "public")));
app.use((req, res, next) => { req.flash = () => []; res.locals.success = []; res.locals.error = []; res.locals.currUser = undefined; res.locals.currentPath = req.path; next(); });
app.use("/", require("../routes/home.js"));
app.use("/listings", require("../routes/listing.js"));
app.use((err, req, res, next) => res.status(500).send(err.message));
let server, base, firstId;
test.before(() => new Promise((resolve) => {
  // sample listings exactly as stored in Atlas today (old illustration URLs) + one user listing
  for (const d of buildDemoDocs().slice(0, 12)) { const l = new FakeListing({ ...d, image: { url: `/images/demo/${d.demoKey.replace("demo-", "")}.svg`, filename: d.image.filename } }); db.set(String(l._id), l); if (!firstId) firstId = String(l._id); }
  const user = new FakeListing({ title: "User Flat", description: "d", price: 3000, location: "Pune", country: "India", image: { url: "/images/properties/surat-02.jpg", filename: "x" }, geometry: { type: "Point", coordinates: [1, 2] } });
  db.set(String(user._id), user);
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());
const get = async (u) => { const r = await fetch(base + u); return { status: r.status, type: r.headers.get("content-type"), text: await r.text() }; };

test("pages: sample cards show the local photographs, never the old .svg illustrations or any external host", async () => {
  for (const url of ["/", "/listings"]) {
    const html = (await get(url)).text;
    const srcs = [...html.matchAll(/<img\s+src="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(srcs.length >= 6, url);
    for (const s of srcs) {
      assert.ok(s.startsWith("/images/"), `${url}: ${s} is a local file`);
      assert.ok(!s.endsWith(".svg") || s === PLACEHOLDER, `${url}: ${s}`);
    }
    assert.ok(srcs.some((s) => /^\/images\/properties\/[a-z]+-0\d\.jpg$/.test(s)), url);
  }
});

test("pages: every photo URL used by the cards is served (200, image/jpeg)", async () => {
  const html = (await get("/listings")).text;
  const srcs = [...new Set([...html.matchAll(/<img\s+src="([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(srcs.length >= 12);
  for (const s of srcs) {
    const r = await fetch(base + s);
    assert.equal(r.status, 200, s);
    assert.match(r.headers.get("content-type"), /image\/(jpeg|svg\+xml)/, s);
    await r.arrayBuffer();
  }
});

test("cards: descriptive alt text, lazy loading, reserved size, and a graceful fallback if a photo fails", async () => {
  const html = (await get("/listings")).text;
  const imgs = html.match(/<img[\s\S]*?\/>/g).filter((i) => i.includes("property-card") === false && i.includes("src=\"/images/"));
  assert.ok(imgs.length >= 12);
  for (const img of imgs) {
    assert.match(img, img.includes("Illustrative photo") ? /alt="[^"]{60,}"/ : /alt="Photo of [^"]{3,}"/, "descriptive alt");
    assert.match(img, /width="900"/);
    assert.match(img, /height="675"/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /decoding="async"/);
    assert.match(img, /onerror="this\.onerror=null;this\.src='\/images\/placeholder-property\.svg';/);
    assert.match(img, /onload="this\.parentNode\.classList\.remove\('is-loading-img'\)"/);
  }
  assert.match(html, /alt="[^"]*Illustrative photo for the sample listing/);
  assert.match(html, /alt="Photo of User Flat"/);
});

test("detail page: large photograph, credit line and the illustrative-photo disclaimer, plus the sample notice", async () => {
  const html = (await get(`/listings/${firstId}`)).text;
  assert.match(html, /<figure class="property-hero is-loading-img">\s*<img\s+src="\/images\/properties\/delhi-01\.jpg"/);
  assert.match(html, /Illustrative stock photo by [^<]+ on Unsplash\. It does not show the actual property\./);
  assert.match(html, /class="sample-notice"/);
  assert.match(html, /class="sample-badge">Sample listing</);
});

test("CSS: 4:3 cards with object-fit: cover, a 16:10 hero, reduced-motion support, visible focus and no fixed-height cropping", () => {
  const css = fs.readFileSync(path.join(ROOT, "public", "css", "style.css"), "utf8");
  assert.match(css, /\.property-card__media\s*\{[^}]*aspect-ratio:\s*4 \/ 3/);
  assert.match(css, /\.property-card__media img\s*\{[^}]*object-fit:\s*cover/);
  assert.match(css, /\.property-hero img\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*16 \/ 10[^}]*object-fit:\s*cover/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px solid/);
  assert.match(css, /\.property-card__title\s*\{[^}]*-webkit-line-clamp:\s*2/);
  assert.match(css, /\.property-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill/);
  assert.ok(!/height:\s*20rem/.test(css));
});
