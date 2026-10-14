// Google sign-in, account linking, session serialization and local-login regression tests.
// The real passport.js, routes/google.js, routes/user.js, middleware and views run. Faked: the Google OAuth
// strategy (reads a simulated profile from the callback URL), the User model (in memory) and the session store.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
const ROOT = path.join(__dirname, "..");
const mongoose = require("mongoose");
const OID = mongoose.Types.ObjectId;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------------- in-memory User model (mimics select:false on hash/salt) ----------------
const store = new Map(); // _id string -> full record, including hash/salt
const state = { forceDup: [], raceWinner: null, failSave: false, failFind: false };
const dupError = (key) => Object.assign(new Error("E11000 duplicate key"), { code: 11000, keyPattern: { [key]: 1 } });
const pub = (rec) => { if (!rec) return null; const { hash, salt, ...rest } = rec; return new FakeUser(rest); };
class FakeUser {
  constructor(d) { Object.assign(this, d); if (!this._id) this._id = new OID(); }
  async save() {
    if (state.failSave) throw new Error("db unavailable");
    if (state.raceWinner) { store.set(String(state.raceWinner._id), state.raceWinner); state.raceWinner = null; }
    const next = state.forceDup.shift();
    if (next) throw dupError(next);
    for (const rec of store.values()) {
      if (String(rec._id) === String(this._id)) continue;
      if (rec.username && rec.username === this.username) throw dupError("username");
      if (this.googleId && rec.googleId === this.googleId) throw dupError("googleId");
    }
    store.set(String(this._id), { ...this });
    return this;
  }
  static findOne(q) {
    const p = Promise.resolve().then(() => {
      if (state.failFind) throw new Error("db unavailable");
      const rec = [...store.values()].find((r) =>
        q.googleId ? r.googleId === q.googleId : q.email ? String(r.email).toLowerCase() === String(q.email).toLowerCase() : false);
      return pub(rec);
    });
    p.collation = () => p;
    return p;
  }
  static async findById(id) { if (state.failFind) throw new Error("db unavailable"); return pub(store.get(String(id))); }
  static async findOneAndUpdate(filter, update) {
    const rec = store.get(String(filter._id));
    if (!rec || (filter.googleId && rec.googleId != null)) return null;
    Object.assign(rec, update.$set);
    return pub(rec);
  }
  static authenticate() {
    return async (username, password, cb) => {
      const rec = [...store.values()].find((r) => r.username === username);
      if (!rec) return cb(null, false, { message: "Password or username is incorrect" });
      if (!rec.hash) return cb(null, false, { message: "Authentication not possible. No salt value stored" });
      if (rec.hash !== sha(password + rec.salt)) return cb(null, false, { message: "Password or username is incorrect" });
      cb(null, pub(rec));
    };
  }
}
const inject = (resolved, exports) => { require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
inject(require.resolve("../models/user.js"), FakeUser);

// ---------------- fake Google strategy: callback URL carries the simulated profile ----------------
const PassportStrategy = require("passport-strategy");
let googleOptions;
class FakeGoogle extends PassportStrategy {
  constructor(opts, verify) { super(); this.name = "google"; googleOptions = opts; this._verify = verify; }
  authenticate(req) {
    if (!req.query.profile) return this.redirect("https://accounts.google.com/o/oauth2/v2/auth?fake=1");
    const profile = JSON.parse(Buffer.from(req.query.profile, "base64url").toString());
    this._verify(req, "access-token", "refresh-token", profile, (err, user, info) => {
      if (err) return this.error(err);
      if (!user) return this.fail(info);
      this.success(user, info);
    });
  }
}
inject(require.resolve("passport-google-oauth2"), { Strategy: FakeGoogle });

// ---------------- app under test ----------------
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { isLoggedIn } = require("../middleware.js");
const { googleEnabled } = require("../passport.js");

const SESSION_SECRET = "test-session-secret";
const sessionStore = new session.MemoryStore();
const app = express();
app.engine("ejs", require("ejs-mate"));
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(session({ store: sessionStore, secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(FakeUser.authenticate()));
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});
app.use("/", require("../routes/google.js"));
app.use("/", require("../routes/user.js"));
app.get("/success", (req, res) => res.send("listings page"));
app.get("/listings", (req, res) => res.send("listings page"));
app.get("/whoami", (req, res) =>
  res.json(req.user ? { id: String(req.user._id), username: req.user.username, email: req.user.email, hasSecrets: "hash" in req.user || "salt" in req.user } : { anonymous: true }));
app.get("/protected", isLoggedIn, (req, res) => res.json({ validObjectId: /^[0-9a-f]{24}$/.test(String(req.user._id)), username: req.user.username }));
app.use((err, req, res, next) => res.status(err.statusCode || 500).send(err.message || "error"));

let server, base;
test.before(() => new Promise((resolve) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); }));
test.after(() => server.close());
test.beforeEach(() => {
  store.clear(); sessionStore.sessions = {};
  Object.assign(state, { forceDup: [], raceWinner: null, failSave: false, failFind: false });
});

const makeClient = () => {
  const jar = {};
  return async (method, url, form, extraCookie) => {
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") + (extraCookie ? `; ${extraCookie}` : "");
    const res = await fetch(base + url, {
      method, redirect: "manual",
      headers: { ...(cookie ? { cookie } : {}), ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: form ? new URLSearchParams(form) : undefined,
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, loc: res.headers.get("location"), text, json };
  };
};
const profile = (o = {}) => ({
  id: "g-1001", email: "Alice@Example.com", email_verified: true, displayName: "Alice Smith",
  name: { givenName: "Alice", familyName: "Smith" }, emails: [{ value: "Alice@Example.com", type: "account" }], ...o,
});
const googleCallback = (client, p = profile()) =>
  client("GET", `/google/callback?code=abc&profile=${Buffer.from(JSON.stringify(p)).toString("base64url")}`);
const addLocal = ({ username = "alice_local", email = "alice@example.com", password = "pw-12345", googleId } = {}) => {
  const rec = { _id: new OID(), username, email, salt: "salt1", hash: sha(password + "salt1"), ...(googleId ? { googleId } : {}) };
  store.set(String(rec._id), rec);
  return rec;
};
const addGoogleOnly = ({ username = "gonly1234", email = "g@example.com", googleId = "g-2002" } = {}) => {
  const rec = { _id: new OID(), username, email, googleId };
  store.set(String(rec._id), rec);
  return rec;
};
const snapshot = () => JSON.stringify([...store.entries()]);
const loginLocal = async (client, username = "alice_local", password = "pw-12345") => client("POST", "/login", { username, password });

// ---------------- strategy registration ----------------
test("Google strategy registers with the unchanged callback route and request-aware verify", () => {
  assert.equal(googleEnabled, true);
  assert.equal(googleOptions.callbackURL, "/google/callback");
  assert.equal(googleOptions.passReqToCallback, true);
  assert.equal(googleOptions.clientID, process.env.GOOGLE_CLIENT_ID);
});

test("without credentials the Google strategy is not registered and the app module still loads", () => {
  const env = { ...process.env }; delete env.GOOGLE_CLIENT_ID; delete env.GOOGLE_CLIENT_SECRET;
  const r = spawnSync(process.execPath, ["-e", 'const p=require("./passport.js"); const pp=require("passport"); console.log(JSON.stringify({enabled:p.googleEnabled, registered:!!pp._strategy("google")}))'], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim().split("\n").pop()), { enabled: false, registered: false });
});

test("GET /google starts the OAuth flow", async () => {
  const r = await makeClient()("GET", "/google");
  assert.equal(r.status, 302);
  assert.match(r.loc, /^https:\/\/accounts\.google\.com\//);
});

// ---------------- creating and returning Google users ----------------
test("new Google user: account is created (no password), logged in, session holds only the id", async () => {
  const c = makeClient();
  const r = await googleCallback(c);
  assert.equal(r.status, 302);
  assert.equal(r.loc, "/success");
  assert.equal(store.size, 1);
  const rec = [...store.values()][0];
  assert.equal(rec.email, "alice@example.com");
  assert.equal(rec.googleId, "g-1001");
  assert.match(rec.username, /^alice\d{4}$/);
  assert.equal(rec.hash, undefined);
  assert.equal(rec.salt, undefined);

  const me = (await c("GET", "/whoami")).json;
  assert.equal(me.id, String(rec._id));
  assert.equal(me.username, rec.username);
  assert.equal(me.hasSecrets, false);

  const sessions = Object.values(sessionStore.sessions).map((s) => JSON.parse(s));
  const withUser = sessions.find((s) => s.passport);
  assert.equal(withUser.passport.user, String(rec._id));
  assert.ok(!JSON.stringify(withUser).includes("alice@example.com"), "session must not contain the email");
});

test("returning Google user signs in to the same account (no duplicate)", async () => {
  await googleCallback(makeClient());
  const id = String([...store.keys()][0]);
  const c2 = makeClient();
  const r = await googleCallback(c2);
  assert.equal(r.loc, "/success");
  assert.equal(store.size, 1);
  assert.equal((await c2("GET", "/whoami")).json.id, id);
});

test("Google user can use login-protected pages and has a valid ObjectId for listings, reviews and bookings", async () => {
  const c = makeClient();
  await googleCallback(c);
  const r = await c("GET", "/protected");
  assert.equal(r.status, 200);
  assert.equal(r.json.validObjectId, true);
});

test("username collision: retries with a new number instead of failing", async () => {
  state.forceDup = ["username"];
  const c = makeClient();
  const r = await googleCallback(c);
  assert.equal(r.loc, "/success");
  assert.equal(store.size, 1);
});

test("two simultaneous first sign-ins: the loser uses the account the winner created", async () => {
  // The other request's account appears after our lookups but before our save, so the save hits the unique googleId index.
  const winner = { _id: new OID(), username: "alice4242", email: "alice@example.com", googleId: "g-1001" };
  state.raceWinner = winner;
  const c = makeClient();
  const r = await googleCallback(c);
  assert.equal(r.loc, "/success");
  assert.equal(store.size, 1);
  assert.equal((await c("GET", "/whoami")).json.id, String(winner._id));
});

test("unexpected database error while creating the account -> 500, nothing saved, not logged in", async () => {
  state.failSave = true;
  const c = makeClient();
  const r = await googleCallback(c);
  assert.equal(r.status, 500);
  assert.equal(store.size, 0);
  assert.equal((await c("GET", "/whoami")).json.anonymous, true);
});

// ---------------- duplicate emails and account linking ----------------
test("same email as an existing password account is refused, not auto-linked, and nothing changes", async () => {
  addLocal({ email: "alice@example.com" });
  const before = snapshot();
  const c = makeClient();
  const r = await googleCallback(c, profile({ email: "ALICE@example.com" })); // different case
  assert.equal(r.status, 302);
  assert.equal(r.loc, "/login");
  const page = await c("GET", "/login"); // follow the redirect first: flash messages are shown once
  assert.match(page.text, /account with this email already exists/i);
  assert.equal(snapshot(), before, "existing account must be untouched");
  assert.equal(store.size, 1);
  assert.equal((await c("GET", "/whoami")).json.anonymous, true);
});

test("logged-in password user links Google: only googleId is added; password, username and email untouched", async () => {
  const local = addLocal({ email: "alice@example.com" });
  const before = { ...store.get(String(local._id)) };
  const c = makeClient();
  assert.equal((await loginLocal(c)).loc, "/listings");
  const r = await googleCallback(c, profile({ id: "g-777", email: "someone.else@gmail.com" }));
  assert.equal(r.loc, "/success");
  const after = store.get(String(local._id));
  assert.equal(after.googleId, "g-777");
  assert.equal(after.hash, before.hash);
  assert.equal(after.salt, before.salt);
  assert.equal(after.username, before.username);
  assert.equal(after.email, before.email);
  assert.equal(store.size, 1);
  assert.equal((await c("GET", "/whoami")).json.id, String(local._id));
  // and the linked Google identity now signs in to the same account
  const c2 = makeClient();
  await googleCallback(c2, profile({ id: "g-777", email: "someone.else@gmail.com" }));
  assert.equal((await c2("GET", "/whoami")).json.id, String(local._id));
  assert.equal(store.size, 1);
});

test("a Google account already linked to another user cannot be linked again", async () => {
  addGoogleOnly({ googleId: "g-555", username: "other1234", email: "other@example.com" });
  const local = addLocal({ email: "me@example.com", username: "me_local" });
  const before = snapshot();
  const c = makeClient();
  await loginLocal(c, "me_local");
  const r = await googleCallback(c, profile({ id: "g-555" }));
  assert.equal(r.loc, "/login");
  assert.equal(snapshot(), before);
  assert.equal((await c("GET", "/login")).text.includes("already linked to a different Elites Hub account"), true);
  assert.equal((await c("GET", "/whoami")).json.id, String(local._id)); // still signed in as themselves
});

test("an account that already has a Google id is never overwritten with another one", async () => {
  const local = addLocal({ googleId: "g-111" });
  const before = snapshot();
  const c = makeClient();
  await loginLocal(c);
  const r = await googleCallback(c, profile({ id: "g-999" }));
  assert.equal(r.loc, "/login");
  assert.equal(snapshot(), before);
  assert.equal(store.get(String(local._id)).googleId, "g-111");
});

test("unverified or missing email is refused and creates nothing", async () => {
  for (const p of [profile({ email_verified: false }), profile({ email_verified: undefined }), profile({ email: undefined, emails: undefined })]) {
    const c = makeClient();
    const r = await googleCallback(c, p);
    assert.equal(r.loc, "/login");
    assert.equal((await c("GET", "/login")).text.includes("verified email"), true);
  }
  assert.equal(store.size, 0);
});

test("profile without an id is refused", async () => {
  const r = await googleCallback(makeClient(), profile({ id: undefined }));
  assert.equal(r.loc, "/login");
  assert.equal(store.size, 0);
});

// ---------------- privacy ----------------
test("signing in with Google logs no profile or personal information", async () => {
  const seen = [];
  const orig = {};
  for (const m of ["log", "info", "warn", "error", "debug"]) { orig[m] = console[m]; console[m] = (...a) => seen.push(a.map(String).join(" ")); }
  try { await googleCallback(makeClient()); } finally { for (const m of Object.keys(orig)) console[m] = orig[m]; }
  const joined = seen.join("\n");
  for (const secret of ["alice@example.com", "Alice", "Smith", "g-1001", "access-token"]) {
    assert.ok(!joined.toLowerCase().includes(secret.toLowerCase()), `log output must not contain "${secret}"`);
  }
});

// ---------------- serialization ----------------
test("serializeUser stores only the user id string", async () => {
  const id = await new Promise((resolve, reject) => passport.serializeUser(new FakeUser({ username: "x", email: "x@x.com" }), (e, v) => (e ? reject(e) : resolve(v))));
  assert.match(id, /^[0-9a-f]{24}$/);
});

const deserialize = (v) => new Promise((resolve) => passport.deserializeUser(v, (err, user) => resolve({ err, user })));
test("deserializeUser loads a user without password hash/salt", async () => {
  const rec = addLocal();
  const { err, user } = await deserialize(String(rec._id));
  assert.equal(err, null);
  assert.equal(user.username, "alice_local");
  assert.equal("hash" in user || "salt" in user, false);
});

test("deserializeUser treats unknown ids, deleted users and old-format sessions as logged out (no crash)", async () => {
  for (const v of [String(new OID()), { _id: "abc", username: "old", hash: "x" }, "not-an-id", 12345, null, undefined]) {
    const { err, user } = await deserialize(v);
    assert.equal(err, null, `value ${JSON.stringify(v)}`);
    assert.equal(user, false);
  }
});

test("deserializeUser passes database errors on", async () => {
  state.failFind = true;
  const { err } = await deserialize(String(new OID()));
  assert.ok(err instanceof Error);
});

test("a session written by the old code (whole user object) is treated as anonymous, not a 500", async () => {
  const sid = "legacy-session-id";
  sessionStore.sessions[sid] = JSON.stringify({ cookie: { originalMaxAge: null, expires: null, httpOnly: true, path: "/" }, passport: { user: { username: "old", hash: "x", salt: "y" } } });
  const signed = "s:" + sid + "." + crypto.createHmac("sha256", SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
  const r = await makeClient()("GET", "/whoami", null, "connect.sid=" + encodeURIComponent(signed));
  assert.equal(r.status, 200);
  assert.equal(r.json.anonymous, true);
});

// ---------------- local username/password regression ----------------
test("local login still works: session holds only the id, req.user has no secrets", async () => {
  const rec = addLocal();
  const c = makeClient();
  const r = await loginLocal(c);
  assert.equal(r.status, 302);
  assert.equal(r.loc, "/listings");
  const me = (await c("GET", "/whoami")).json;
  assert.equal(me.id, String(rec._id));
  assert.equal(me.username, "alice_local");
  assert.equal(me.hasSecrets, false);
  const stored = Object.values(sessionStore.sessions).map((s) => JSON.parse(s)).find((s) => s.passport);
  assert.equal(stored.passport.user, String(rec._id));
  assert.equal((await c("GET", "/protected")).status, 200);
});

test("local login with a wrong password or unknown user is rejected", async () => {
  addLocal();
  for (const [u, p] of [["alice_local", "wrong"], ["nobody", "pw-12345"]]) {
    const c = makeClient();
    const r = await loginLocal(c, u, p);
    assert.equal(r.loc, "/login");
    assert.equal((await c("GET", "/whoami")).json.anonymous, true);
  }
});

test("a Google-only account (no password) cannot be used for password login", async () => {
  addGoogleOnly({ username: "gonly1234" });
  const c = makeClient();
  const r = await loginLocal(c, "gonly1234", "anything");
  assert.equal(r.loc, "/login");
  assert.equal((await c("GET", "/whoami")).json.anonymous, true);
});

test("logout ends the session for local and Google users", async () => {
  addLocal();
  const c1 = makeClient();
  await loginLocal(c1);
  assert.equal((await c1("GET", "/logout")).status, 302);
  assert.equal((await c1("GET", "/whoami")).json.anonymous, true);

  const c2 = makeClient();
  await googleCallback(c2);
  assert.equal((await c2("GET", "/logout")).status, 302);
  assert.equal((await c2("GET", "/whoami")).json.anonymous, true);
});

test("protected pages still redirect anonymous visitors to the login page", async () => {
  const r = await makeClient()("GET", "/protected");
  assert.equal(r.status, 302);
  assert.equal(r.loc, "/login");
});
