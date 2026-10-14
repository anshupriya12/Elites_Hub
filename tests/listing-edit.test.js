// Listing navigation, edit form, save flow and unsaved-changes guard tests.
// Real routes, middleware, validation, controller, views and session/flash run. Faked: Cloudinary, Mapbox and the
// Listing model (in memory). The browser-side guard script runs in a minimal simulated browser environment.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

process.env.MAP_TOKEN = "pk.test-token";
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;

// ---------------- fakes ----------------
const state = {};
const resetState = () => Object.assign(state, { geoQueries: [], saved: 0, destroyed: [] });
resetState();
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
inject(require.resolve("cloudinary"), { v2: { config() {}, uploader: { destroy: async (id) => state.destroyed.push(id) } } });
inject(require.resolve("multer-storage-cloudinary"), {
  CloudinaryStorage: class {
    _handleFile(req, file, cb) {
      file.stream.on("data", () => {});
      file.stream.on("end", () => cb(null, { path: "https://res.cloudinary.com/demo/upload/new.png", filename: "wanderlust_DEV/new", size: 1 }));
    }
    _removeFile(req, file, cb) { cb(null); }
  },
});
inject(require.resolve("@mapbox/mapbox-sdk/services/geocoding"), () => ({
  forwardGeocode: (opts) => ({ send: async () => { state.geoQueries.push(opts.query); return { body: { features: [{ geometry: { type: "Point", coordinates: [10, 20] } }] } }; } }),
}));

const OWNER = new OID();
const OTHER = new OID();
const db = new Map();
class FakeListing {
  constructor(d) { Object.assign(this, d); this._id = new OID(); }
  set(d) { Object.assign(this, d); }
  async save() { state.saved++; return this; }
  static findById(id) {
    const doc = db.get(String(id)) || null;
    const p = Promise.resolve(doc);
    p.populate = () => p; // owner is already stored in its populated shape
    return p;
  }
}
inject(require.resolve("../models/listing.js"), FakeListing);
const makeListing = (over = {}) => {
  const l = new FakeListing({
    title: "Sea Villa", description: "A lovely place by the sea", price: 2500, location: "Goa", country: "India",
    image: { url: "https://res.cloudinary.com/demo/upload/old.png", filename: "wanderlust_DEV/old" },
    geometry: { type: "Point", coordinates: [1, 2] }, reviews: [],
    owner: { _id: OWNER, username: "host", equals: (o) => String(o) === String(OWNER) }, ...over,
  });
  db.set(String(l._id), l);
  return l;
};

// ---------------- app under test ----------------
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.static(path.join(ROOT, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "test", resave: false, saveUninitialized: false }));
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
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => { resetState(); db.clear(); });

const makeClient = (user = "owner") => {
  let sid = "";
  return async (method, url, fields, { asUser = user } = {}) => {
    let body;
    if (fields) { body = new FormData(); for (const [k, v] of Object.entries(fields)) body.append(`listing[${k}]`, v); }
    const res = await fetch(base + url, { method, body, redirect: "manual", headers: { ...(asUser ? { "x-user": asUser } : {}), ...(sid ? { cookie: sid } : {}) } });
    const sc = res.headers.getSetCookie().find((c) => c.startsWith("connect.sid="));
    if (sc) sid = sc.split(";")[0];
    return { status: res.status, loc: res.headers.get("location"), text: await res.text() };
  };
};
const decode = (s) => s.replace(/&#34;|&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// ---------------- navigation ----------------
test("listing detail page has a Back to Listings link (for visitors and owners)", async () => {
  const l = makeListing();
  for (const user of [null, "owner", "other"]) {
    const r = await makeClient(user)("GET", `/listings/${l._id}`);
    assert.equal(r.status, 200);
    assert.match(r.text, /<a href="\/listings"[^>]*>[^<]*Back to Listings<\/a>/);
  }
});

test("edit page has links back to the listing, plus a Cancel link", async () => {
  const l = makeListing();
  const html = (await makeClient()("GET", `/listings/${l._id}/edit`)).text;
  assert.match(html, new RegExp(`<a href="/listings/${l._id}"[^>]*>[^<]*Back to listing</a>`));
  assert.match(html, new RegExp(`<a href="/listings/${l._id}"[^>]*>Cancel</a>`));
});

// ---------------- edit form ----------------
test("edit form has a visible Save Changes submit button and prefilled, labelled fields", async () => {
  const l = makeListing();
  const html = (await makeClient()("GET", `/listings/${l._id}/edit`)).text;
  assert.match(html, /<button type="submit"[^>]*>Save Changes<\/button>/);
  assert.match(html, /action="\/listings\/[0-9a-f]{24}\?_method=PUT"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  for (const [field, value] of [["title", "Sea Villa"], ["price", "2500"], ["country", "India"], ["location", "Goa"]]) {
    assert.match(html, new RegExp(`id="${field}"\\s+name="listing\\[${field}\\]"\\s+value="${value}"`), field);
    assert.match(html, new RegExp(`<label for="${field}"`), `label for ${field}`);
  }
  assert.match(html, /<textarea id="description" name="listing\[description\]"[^>]*>A lovely place by the sea<\/textarea>/);
  assert.match(html, /<input id="image" name="listing\[image\]" type="file"/);
});

test("description textarea has no leading/trailing whitespace added by the template", async () => {
  const l = makeListing({ description: "Exactly this" });
  const html = (await makeClient()("GET", `/listings/${l._id}/edit`)).text;
  const m = html.match(/<textarea[^>]*name="listing\[description\]"[^>]*>([\s\S]*?)<\/textarea>/);
  assert.equal(m[1], "Exactly this");
});

test("submitting the edit form exactly as rendered (all fields) saves successfully", async () => {
  const l = makeListing();
  const c = makeClient();
  const html = (await c("GET", `/listings/${l._id}/edit`)).text;
  const fields = {};
  for (const tag of html.match(/<input\b[^>]*>/g)) {
    const name = (tag.match(/name="listing\[(\w+)\]"/) || [])[1];
    const type = (tag.match(/type="(\w+)"/) || [])[1];
    if (name && type !== "file") fields[name] = decode((tag.match(/value="([^"]*)"/) || [])[1] || "");
  }
  fields.description = decode(html.match(/<textarea[^>]*name="listing\[description\]"[^>]*>([\s\S]*?)<\/textarea>/)[1]);
  assert.deepEqual(Object.keys(fields).sort(), ["country", "description", "location", "price", "title"]);
  const r = await c("PUT", `/listings/${l._id}`, fields);
  assert.equal(r.status, 302);
  assert.equal(r.loc, `/listings/${l._id}`);
  assert.equal(state.geoQueries.length, 0, "unchanged place must not be re-geocoded");
});

// ---------------- save flow ----------------
test("saving shows a confirmation and the updated details, which persist after a refresh", async () => {
  const l = makeListing();
  const c = makeClient();
  const save = await c("PUT", `/listings/${l._id}`, { title: "  Beach House ", description: "Brand new description", price: "3500", location: "Panaji", country: "India" });
  assert.equal(save.status, 302);
  assert.equal(save.loc, `/listings/${l._id}`);

  const shown = await c("GET", save.loc);
  assert.equal(shown.status, 200);
  assert.match(shown.text, /Changes saved successfully\./);
  for (const expected of ["Beach House", "Brand new description", "3,500", "Panaji"]) assert.ok(shown.text.includes(expected), expected);
  assert.ok(!shown.text.includes("Sea Villa"));
  assert.deepEqual(db.get(String(l._id)).geometry.coordinates, [10, 20], "location change updates coordinates");

  const refreshed = await c("GET", save.loc); // a refresh: details persist, the one-time message is gone
  assert.ok(refreshed.text.includes("Beach House") && refreshed.text.includes("3,500"));
  assert.ok(!refreshed.text.includes("Changes saved successfully."));
});

test("a rejected save keeps the original data and shows no confirmation", async () => {
  const l = makeListing();
  const c = makeClient();
  const r = await c("PUT", `/listings/${l._id}`, { title: "X", description: "Y", price: "0", location: "Goa", country: "India" });
  assert.equal(r.status, 400);
  const shown = await c("GET", `/listings/${l._id}`);
  assert.ok(shown.text.includes("Sea Villa"));
  assert.ok(!shown.text.includes("Changes saved successfully."));
  assert.equal(state.saved, 0);
});

// ---------------- authentication / ownership still enforced ----------------
test("edit and save remain owner-only; anonymous visitors go to login", async () => {
  const l = makeListing();
  const anon = makeClient(null);
  assert.equal((await anon("GET", `/listings/${l._id}/edit`)).loc, "/login");
  assert.equal((await anon("PUT", `/listings/${l._id}`, { title: "Hacked", description: "d", price: "1", location: "Goa", country: "India" })).loc, "/login");

  const other = makeClient("other");
  const form = await other("GET", `/listings/${l._id}/edit`);
  assert.equal(form.status, 302);
  assert.equal(form.loc, `/listings/${l._id}`);
  assert.match((await other("GET", form.loc)).text, /Only the owner can edit\/delete the listing/);
  const put = await other("PUT", `/listings/${l._id}`, { title: "Hacked", description: "d", price: "1", location: "Goa", country: "India" });
  assert.equal(put.status, 302);
  assert.equal(db.get(String(l._id)).title, "Sea Villa");
  assert.equal(state.saved, 0);
});

// ---------------- unsaved-changes guard (browser script) ----------------
const GUARD_SRC = fs.readFileSync(path.join(ROOT, "public", "js", "unsaved-guard.js"), "utf8");
const runGuard = ({ withForm = true } = {}) => {
  const fields = [
    { name: "listing[title]", type: "text", value: "Sea Villa" },
    { name: "listing[price]", type: "number", value: "2500" },
    { name: "listing[image]", type: "file", files: { length: 0 } },
    { name: "", type: "submit", value: "Save" },
  ];
  const handlers = { form: {}, window: {} };
  const hidden = { value: true };
  const timers = [];
  const form = { elements: fields, addEventListener: (t, f) => (handlers.form[t] = handlers.form[t] || []).push(f) };
  const notice = { classList: { toggle: (cls, force) => { if (cls === "d-none") hidden.value = !!force; } } };
  const win = { addEventListener: (t, f) => (handlers.window[t] = handlers.window[t] || []).push(f) };
  vm.runInNewContext(GUARD_SRC, {
    document: { querySelector: () => (withForm ? form : null), getElementById: () => notice },
    window: win, setTimeout: (f) => timers.push(f),
  });
  const fire = (target, type, ev = {}) => (handlers[target][type] || []).forEach((h) => h(ev));
  const leave = () => { const ev = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } }; fire("window", "beforeunload", ev); return ev; };
  return { fields, handlers, hidden, fire, leave, flush: () => timers.splice(0).forEach((f) => f()) };
};

test("guard: an untouched form never prompts", () => {
  const g = runGuard();
  assert.equal(g.leave().prevented, false);
  assert.equal(g.hidden.value, true);
});

test("guard: editing a field prompts before leaving (Back, links, reload, close) and shows the notice", () => {
  const g = runGuard();
  g.fields[0].value = "Beach House";
  g.fire("form", "input");
  assert.equal(g.hidden.value, false, "unsaved-changes notice visible");
  const ev = g.leave();
  assert.equal(ev.prevented, true);
  assert.equal(ev.returnValue, "");
});

test("guard: changing a value back to the original is not treated as unsaved", () => {
  const g = runGuard();
  g.fields[1].value = "9999"; g.fire("form", "input");
  g.fields[1].value = "2500"; g.fire("form", "input");
  assert.equal(g.leave().prevented, false);
  assert.equal(g.hidden.value, true);
});

test("guard: choosing a new image counts as an unsaved change", () => {
  const g = runGuard();
  g.fields[2].files = { length: 1 };
  g.fire("form", "change");
  assert.equal(g.leave().prevented, true);
});

test("guard: a valid submit (Save Changes) leaves without a prompt", () => {
  const g = runGuard();
  g.fields[0].value = "Beach House";
  g.fire("form", "input");
  g.fire("form", "submit", { defaultPrevented: false });
  g.flush();
  assert.equal(g.leave().prevented, false);
});

test("guard: a submit blocked by validation keeps the protection", () => {
  const g = runGuard();
  g.fields[0].value = "";
  g.fire("form", "input");
  g.fire("form", "submit", { defaultPrevented: true });
  g.flush();
  assert.equal(g.leave().prevented, true);
  assert.equal(g.hidden.value, false);
});

test("guard: does nothing on pages without an opted-in form", () => {
  const g = runGuard({ withForm: false });
  assert.deepEqual(g.handlers, { form: {}, window: {} });
});

test("guard never saves automatically (no submit/fetch/XHR calls in the script)", () => {
  assert.ok(!/\.submit\(|fetch\(|XMLHttpRequest|sendBeacon/.test(GUARD_SRC));
});

test("edit page opts in to the guard and the script is served", async () => {
  const l = makeListing();
  const html = (await makeClient()("GET", `/listings/${l._id}/edit`)).text;
  assert.match(html, /<form[^>]*data-unsaved-guard/);
  assert.match(html, /<span id="unsaved-notice"[^>]*class="[^"]*d-none/);
  assert.match(html, /<script src="\/js\/unsaved-guard\.js"><\/script>/);
  const js = await fetch(`${base}/js/unsaved-guard.js`);
  assert.equal(js.status, 200);
  assert.match(await js.text(), /beforeunload/);
});
