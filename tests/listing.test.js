// Listing create/update tests. Real routes, middleware, Joi schema, multer, controller and views run;
// Cloudinary, Mapbox and the Listing model are replaced with in-memory fakes. No network, no database.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.env.MAP_TOKEN = "pk.test-token";
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;

// ---- fakes (injected into the require cache before the app code loads) ----
const state = {};
const resetState = () => {
  Object.assign(state, {
    destroyed: [], saved: [], uploads: 0, geoQueries: [], geoMode: "ok", failSave: false, failUpload: false, db: new Map(),
  });
};
resetState();

const inject = (resolved, exports) => {
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
let storageParams;
inject(require.resolve("cloudinary"), {
  v2: { config() {}, uploader: { destroy: async (id) => { if (state.destroyFails) throw new Error("boom"); state.destroyed.push(id); } } },
});
inject(require.resolve("multer-storage-cloudinary"), {
  CloudinaryStorage: class {
    constructor(opts) { storageParams = opts.params; }
    _handleFile(req, file, cb) {
      file.stream.on("data", () => {});
      file.stream.on("end", () => {
        if (state.failUpload) return cb(new Error("cloudinary unavailable"));
        state.uploads++;
        cb(null, { path: `https://res.cloudinary.com/demo/upload/img${state.uploads}.png`, filename: `wanderlust_DEV/img${state.uploads}`, size: 1 });
      });
    }
    _removeFile(req, file, cb) { cb(null); }
  },
});
inject(require.resolve("@mapbox/mapbox-sdk/services/geocoding"), () => ({
  forwardGeocode: (opts) => ({
    send: async () => {
      state.geoQueries.push(opts.query);
      if (state.geoMode === "throw") throw Object.assign(new Error("mapbox down"), { statusCode: 500 });
      if (state.geoMode === "empty") return { body: { features: [] } };
      if (state.geoMode === "noGeometry") return { body: { features: [{}] } };
      return { body: { features: [{ geometry: { type: "Point", coordinates: [73.8, 15.4] } }] } };
    },
  }),
}));
class FakeListing {
  constructor(data) { Object.assign(this, data); this._id = new OID(); }
  set(d) { Object.assign(this, d); }
  async save() { if (state.failSave) throw new Error("db unavailable"); state.saved.push(this); return this; }
  static async findById(id) { return state.db.get(String(id)) || null; }
}
inject(require.resolve("../models/listing.js"), FakeListing);

const express = require("express");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
const OWNER = new OID();
const OTHER = new OID();
app.use((req, res, next) => {
  const who = req.headers["x-user"];
  req.user = who ? { _id: who === "owner" ? OWNER : OTHER, username: who } : undefined;
  req.isAuthenticated = () => !!req.user;
  req.session = {};
  req.flash = () => [];
  res.locals.success = []; res.locals.error = []; res.locals.currUser = req.user;
  next();
});
app.use("/listings", require("../routes/listing.js"));
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => { resetState(); state.destroyFails = false; });

const fields = (over = {}) => ({ title: "  Sea Villa  ", description: "A lovely place", location: "Goa", country: "India", price: "2500", ...over });
const send = async (method, url, { f = fields(), file = { type: "image/png", name: "a.png", size: 100 }, user = "owner" } = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) if (v !== undefined) fd.append(`listing[${k}]`, v);
  if (file) fd.append("listing[image]", new Blob([Buffer.alloc(file.size, 1)], { type: file.type }), file.name);
  const res = await fetch(base + url, { method, body: fd, redirect: "manual", headers: user ? { "x-user": user } : {} });
  return { status: res.status, text: await res.text(), loc: res.headers.get("location") };
};
const makeListing = (over = {}) => {
  const l = new FakeListing({
    title: "Old", description: "Old description", price: 1000, location: "Goa", country: "India", owner: OWNER,
    image: { url: "https://res.cloudinary.com/demo/upload/old.png", filename: "wanderlust_DEV/old" },
    geometry: { type: "Point", coordinates: [1, 2] }, ...over,
  });
  state.db.set(String(l._id), l);
  return l;
};

// ---------------- create ----------------
test("create: valid listing is trimmed, geocoded (with country), saved and redirects", async () => {
  const r = await send("POST", "/listings");
  assert.equal(r.status, 302);
  assert.equal(state.saved.length, 1);
  const l = state.saved[0];
  assert.equal(l.title, "Sea Villa");
  assert.equal(l.price, 2500);
  assert.equal(typeof l.price, "number");
  assert.deepEqual(l.geometry.coordinates, [73.8, 15.4]);
  assert.equal(l.image.filename, "wanderlust_DEV/img1");
  assert.equal(String(l.owner), String(OWNER));
  assert.deepEqual(state.geoQueries, ["Goa, India"]);
  assert.deepEqual(state.destroyed, []);
});

test("create: missing image -> 400, no geocode call, nothing saved", async () => {
  const r = await send("POST", "/listings", { file: null });
  assert.equal(r.status, 400);
  assert.match(r.text, /upload an image/i);
  assert.equal(state.geoQueries.length, 0);
  assert.equal(state.saved.length, 0);
});

for (const [name, over] of [
  ["price 0", { price: "0" }],
  ["negative price", { price: "-5" }],
  ["non-numeric price", { price: "abc" }],
  ["price above limit", { price: "100001" }],
  ["missing title", { title: undefined }],
  ["blank (whitespace) title", { title: "   " }],
  ["over-long title", { title: "x".repeat(101) }],
  ["over-long description", { description: "x".repeat(2001) }],
  ["over-long location", { location: "x".repeat(101) }],
  ["unknown field (owner)", { owner: "abc" }],
]) {
  test(`create: invalid input (${name}) -> 400, uploaded image removed, nothing saved`, async () => {
    const r = await send("POST", "/listings", { f: fields(over) });
    assert.equal(r.status, 400);
    assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
    assert.equal(state.saved.length, 0);
    assert.equal(state.geoQueries.length, 0);
  });
}

test("create: geocoding returns no results -> friendly 400, image removed, nothing saved", async () => {
  state.geoMode = "empty";
  const r = await send("POST", "/listings");
  assert.equal(r.status, 400);
  assert.match(r.text, /could not find that location/i);
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
  assert.equal(state.saved.length, 0);
});

test("create: geocoding result without geometry is treated as no result", async () => {
  state.geoMode = "noGeometry";
  const r = await send("POST", "/listings");
  assert.equal(r.status, 400);
  assert.equal(state.saved.length, 0);
});

test("create: Mapbox error -> 502, image removed, nothing saved", async () => {
  state.geoMode = "throw";
  const r = await send("POST", "/listings");
  assert.equal(r.status, 502);
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
  assert.equal(state.saved.length, 0);
});

test("create: database save failure -> 500, uploaded image removed", async () => {
  state.failSave = true;
  const r = await send("POST", "/listings");
  assert.equal(r.status, 500);
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
});

test("create: Cloudinary upload failure -> 500, nothing saved, no cleanup attempted", async () => {
  state.failUpload = true;
  const r = await send("POST", "/listings");
  assert.equal(r.status, 500);
  assert.equal(state.saved.length, 0);
  assert.deepEqual(state.destroyed, []);
});

test("create: non-image file is rejected before upload", async () => {
  const r = await send("POST", "/listings", { file: { type: "text/plain", name: "a.txt", size: 10 } });
  assert.equal(r.status, 400);
  assert.match(r.text, /PNG, JPG or WebP/);
  assert.equal(state.uploads, 0);
  assert.equal(state.saved.length, 0);
});

test("create: image over 5 MB is rejected", async () => {
  const r = await send("POST", "/listings", { file: { type: "image/png", name: "big.png", size: 5 * 1024 * 1024 + 10 } });
  assert.equal(r.status, 400);
  assert.match(r.text, /5 MB/);
  assert.equal(state.saved.length, 0);
});

test("create: requires login (no upload happens)", async () => {
  const r = await send("POST", "/listings", { user: null });
  assert.equal(r.status, 302);
  assert.equal(r.loc, "/login");
  assert.equal(state.uploads, 0);
});

// ---------------- update ----------------
test("update: changed location re-geocodes and updates coordinates", async () => {
  const l = makeListing();
  const r = await send("PUT", `/listings/${l._id}`, { f: fields({ location: "Panaji" }), file: null });
  assert.equal(r.status, 302);
  assert.deepEqual(state.geoQueries, ["Panaji, India"]);
  assert.deepEqual(l.geometry.coordinates, [73.8, 15.4]);
  assert.equal(l.location, "Panaji");
  assert.equal(l.title, "Sea Villa");
  assert.equal(state.saved.length, 1);
});

test("update: unchanged location does not geocode or move the pin", async () => {
  const l = makeListing();
  const r = await send("PUT", `/listings/${l._id}`, { f: fields({ title: "New title" }), file: null });
  assert.equal(r.status, 302);
  assert.equal(state.geoQueries.length, 0);
  assert.deepEqual(l.geometry.coordinates, [1, 2]);
  assert.equal(l.title, "New title");
});

test("update: listing without stored coordinates is geocoded even if the place is unchanged", async () => {
  const l = makeListing({ geometry: undefined });
  const r = await send("PUT", `/listings/${l._id}`, { f: fields(), file: null });
  assert.equal(r.status, 302);
  assert.equal(state.geoQueries.length, 1);
  assert.deepEqual(l.geometry.coordinates, [73.8, 15.4]);
});

for (const mode of ["empty", "throw"]) {
  test(`update: geocoding ${mode} -> error, existing listing and image left untouched, new upload removed`, async () => {
    const l = makeListing();
    state.geoMode = mode;
    const before = JSON.stringify(l);
    const r = await send("PUT", `/listings/${l._id}`, { f: fields({ location: "Nowhere", title: "Changed" }) });
    assert.equal(r.status, mode === "empty" ? 400 : 502);
    assert.equal(JSON.stringify(l), before);
    assert.equal(state.saved.length, 0);
    assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
  });
}

test("update: new image replaces the old reference; failure on save removes only the new upload", async () => {
  const l = makeListing();
  let r = await send("PUT", `/listings/${l._id}`, { f: fields(), file: { type: "image/jpeg", name: "n.jpg", size: 50 } });
  assert.equal(r.status, 302);
  assert.equal(l.image.filename, "wanderlust_DEV/img1");
  assert.deepEqual(state.destroyed, []);

  state.failSave = true;
  r = await send("PUT", `/listings/${l._id}`, { f: fields({ title: "Again" }), file: { type: "image/png", name: "m.png", size: 50 } });
  assert.equal(r.status, 500);
  // Only the failed request's upload is removed; the listing's earlier image (img1) is never deleted.
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/img2"]);
});

test("update: invalid input -> 400 and the uploaded image is removed", async () => {
  const l = makeListing();
  const r = await send("PUT", `/listings/${l._id}`, { f: fields({ price: "0" }) });
  assert.equal(r.status, 400);
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/img1"]);
});

test("update: non-owner is redirected before any upload", async () => {
  const l = makeListing();
  const r = await send("PUT", `/listings/${l._id}`, { user: "other" });
  assert.equal(r.status, 302);
  assert.equal(state.uploads, 0);
  assert.equal(state.saved.length, 0);
});

// ---------------- edit form / new form ----------------
test("edit form renders for a listing with no image (no crash)", async () => {
  const l = makeListing({ image: undefined });
  const res = await fetch(`${base}/listings/${l._id}/edit`, { headers: { "x-user": "owner" } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /No image uploaded yet/);
  assert.match(html, /name="listing\[price\]"[\s\S]*?type="number"[\s\S]*?min="1"/);
});

test("new listing form uses a numeric price input with a minimum and image-type hint", async () => {
  const res = await fetch(`${base}/listings/new`, { headers: { "x-user": "owner" } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="listing\[price\]"[\s\S]*?type="number"[\s\S]*?min="1"/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
});

// ---------------- cloudinary config / cleanup helper ----------------
test("upload config uses Cloudinary's allowed_formats (not the ignored camelCase option)", () => {
  assert.deepEqual(storageParams.allowed_formats, ["png", "jpg", "jpeg", "webp"]);
  assert.equal(storageParams.allowedFormats, undefined);
});

test("deleteUploadedImage only removes assets in the app folder and never throws", async () => {
  const { deleteUploadedImage } = require("../cloudConfig.js");
  await deleteUploadedImage(undefined);
  await deleteUploadedImage({ filename: "listingimage" }); // seeded/foreign asset
  await deleteUploadedImage({ filename: "other_folder/x" });
  assert.deepEqual(state.destroyed, []);
  await deleteUploadedImage({ filename: "wanderlust_DEV/mine" });
  assert.deepEqual(state.destroyed, ["wanderlust_DEV/mine"]);
  state.destroyFails = true;
  await deleteUploadedImage({ filename: "wanderlust_DEV/mine2" }); // must swallow the error
});
