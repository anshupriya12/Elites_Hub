// Sample-data seed safety: data quality, explicit opt-in, database-target protection, idempotence, and preservation
// of user-created listings and users. Mongoose and the Listing model are replaced by in-memory fakes; the real
// database is never contacted.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const { run, parseDatabaseName, SeedRefusal, REQUIRED_DB } = require("../init/seedDemo.js");
const { demoListings, buildDemoDocs, NOTICE } = require("../init/demoListings.js");

const GOOD_URI = "mongodb+srv://seeduser:s3cr3tpw@cluster.example.net/elites_hub?retryWrites=true&w=majority&appName=X";
const OPT_IN = { ALLOW_DEMO_SEED: "true" };

// ---- fakes ----
const makeEnv = ({ listings = [], connectedName = REQUIRED_DB } = {}) => {
  const store = new Map(listings.map((l, i) => [l._id || `pre${i}`, { ...l, _id: l._id || `pre${i}` }]));
  const log = { connect: 0, disconnect: 0, calls: [], lines: [] };
  const mongoose = {
    connection: { name: connectedName },
    connect: async () => { log.connect++; },
    disconnect: async () => { log.disconnect++; },
  };
  // Only bulkWrite exists: any other method call (deleteMany, updateMany, drop, ...) would throw.
  const Listing = {
    // read-only lookup used for the legacy-records report
    find: (filter) => ({
      lean: async () => [...store.values()].filter((d) => filter.demoKey.$in.includes(d.demoKey)).map(({ demoKey, location }) => ({ demoKey, location })),
    }),
    bulkWrite: async (ops, opts) => {
      log.calls.push({ ops, opts });
      let upsertedCount = 0;
      for (const op of ops) {
        const { filter, update, upsert } = op.updateOne;
        const found = [...store.values()].find((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
        if (!found && upsert) { store.set(`new${store.size}`, { _id: `new${store.size}`, ...filter, ...update.$setOnInsert }); upsertedCount++; }
      }
      return { upsertedCount };
    },
  };
  return { store, log, mongoose, Listing, out: (s) => log.lines.push(s) };
};
const seed = (env, e = {}) => run({ env: { ...OPT_IN, ATLASDB_URL: GOOD_URI, ...e }, argv: [], mongoose: env.mongoose, Listing: env.Listing, log: env.out });
const snap = (store) => JSON.stringify([...store.entries()]);

// ---------------- data quality ----------------
test("demo data: 50 clearly labelled, unowned, valid sample listings (10 cities x 5)", () => {
  const docs = buildDemoDocs();
  assert.equal(docs.length, 50);
  assert.equal(new Set(docs.map((d) => d.demoKey)).size, docs.length, "unique demoKeys");
  assert.equal(new Set(docs.map((d) => d.location)).size, docs.length, "every property has its own locality");
  assert.equal(new Set(docs.map((d) => d.title)).size, docs.length, "unique titles");
  for (const d of docs) {
    assert.match(d.demoKey, /^demo-[a-z0-9-]+$/);
    assert.equal(d.isDemo, true);
    assert.ok(!("owner" in d), "demo listings must not have an owner");
    assert.ok(d.title.endsWith("(Sample)") && d.title.length <= 100, d.title);
    assert.ok(d.description.startsWith(NOTICE), "description carries the sample notice");
    assert.match(NOTICE, /not a real property, not available for booking, and not an actual offer/);
    assert.equal(d.country, "India");
    assert.ok(d.price > 0 && d.price <= 100000, "price valid for editing/booking rules");
    const [lng, lat] = d.geometry.coordinates;
    assert.ok(lng > 68 && lng < 98 && lat > 6 && lat < 37, `${d.location} coordinates inside India`);
    assert.equal(d.geometry.type, "Point");
    assert.match(d.image.url, /^\/images\/demo\/[a-z0-9-]+\.svg$/);
    const file = path.join(ROOT, "public", d.image.url);
    assert.ok(fs.existsSync(file), `image exists: ${d.image.url}`);
    const svg = fs.readFileSync(file, "utf8");
    assert.ok(svg.startsWith("<svg") && svg.includes("SAMPLE ILLUSTRATION"), "generated, labelled illustration");
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(svg), "no external resources in the image");
  }
});

test("demo data passes the real Listing schema validation", () => {
  const Listing = require("../models/listing.js");
  for (const d of buildDemoDocs()) {
    const err = new Listing(d).validateSync();
    assert.equal(err, undefined, `${d.demoKey}: ${err && err.message}`);
  }
});

test("illustrations exist for every demo listing; the only extra files are the legacy ones kept for old records", () => {
  const dir = path.join(ROOT, "public", "images", "demo");
  const { legacyDemoListings } = require("../init/legacyDemo.js");
  const expected = [...demoListings, ...legacyDemoListings].map((d) => `${d.slug}.svg`).sort();
  assert.deepEqual(fs.readdirSync(dir).sort(), expected);
});

// ---------------- opt-in and database-target protection ----------------
test("parseDatabaseName", () => {
  assert.equal(parseDatabaseName(GOOD_URI), "elites_hub");
  assert.equal(parseDatabaseName("mongodb://h1:27017,h2:27017/elites_hub"), "elites_hub");
  assert.equal(parseDatabaseName("mongodb+srv://u:p@c.example.net/?retryWrites=true"), "");
  assert.equal(parseDatabaseName("mongodb+srv://u:p@c.example.net?retryWrites=true"), "");
  assert.equal(parseDatabaseName("mongodb+srv://u:p@c.example.net/test?x=1"), "test");
  assert.equal(parseDatabaseName(undefined), "");
  assert.equal(parseDatabaseName("not a uri"), "");
});

test("refuses without the explicit opt-in and never connects", async () => {
  for (const value of [undefined, "", "false", "TRUE", "1", "yes", " true"]) {
    const env = makeEnv();
    await assert.rejects(() => run({ env: { ATLASDB_URL: GOOD_URI, ALLOW_DEMO_SEED: value }, argv: [], mongoose: env.mongoose, Listing: env.Listing, log: env.out }), SeedRefusal, String(value));
    assert.equal(env.log.connect, 0);
    assert.equal(env.log.calls.length, 0);
  }
});

test("refuses when ATLASDB_URL is missing, and never connects", async () => {
  const env = makeEnv();
  await assert.rejects(() => seed(env, { ATLASDB_URL: "" }), SeedRefusal);
  await assert.rejects(() => seed(env, { ATLASDB_URL: undefined }), SeedRefusal);
  assert.equal(env.log.connect, 0);
});

test("refuses unless the database is exactly elites_hub (checked before connecting)", async () => {
  const base = "mongodb+srv://u:p@c.example.net";
  for (const uri of [
    `${base}/?retryWrites=true`, `${base}?retryWrites=true`, `${base}/test`, `${base}/test?x=1`, `${base}/Elites_Hub`,
    `${base}/elites_hub2`, `${base}/elites_hub_backup`, `${base}/xelites_hub`, `${base}/elites_hub/extra`, `${base}/ elites_hub`,
    `${base}/?authSource=elites_hub`, `${base}/admin?authSource=elites_hub`, "mongodb://localhost:27017/elites",
  ]) {
    const env = makeEnv();
    await assert.rejects(() => seed(env, { ATLASDB_URL: uri }), (e) => e instanceof SeedRefusal && /must be exactly "elites_hub"/.test(e.message), uri);
    assert.equal(env.log.connect, 0, `no connection for ${uri}`);
    assert.equal(env.log.calls.length, 0);
  }
});

test("also refuses if the live connection is not elites_hub, writing nothing and disconnecting", async () => {
  const env = makeEnv({ connectedName: "test" });
  await assert.rejects(() => seed(env), (e) => e instanceof SeedRefusal && /connected database is "test"/.test(e.message));
  assert.equal(env.log.connect, 1);
  assert.equal(env.log.disconnect, 1);
  assert.equal(env.log.calls.length, 0);
});

test("dry run validates the target but never connects or writes", async () => {
  const env = makeEnv();
  const r = await run({ env: { ...OPT_IN, ATLASDB_URL: GOOD_URI }, argv: ["--dry-run"], mongoose: env.mongoose, Listing: env.Listing, log: env.out });
  assert.equal(r.dryRun, true);
  assert.equal(r.planned, buildDemoDocs().length);
  assert.equal(env.log.connect, 0);
  assert.equal(env.log.calls.length, 0);
  assert.ok(env.log.lines.join("\n").includes("demo-delhi-01"));
  assert.ok(env.log.lines.join("\n").includes("demo-jaipur-05"));
  // a dry run still refuses a wrong database
  await assert.rejects(() => run({ env: { ...OPT_IN, ATLASDB_URL: "mongodb+srv://u:p@c.example.net/test" }, argv: ["--dry-run"], log: env.out }), SeedRefusal);
});

// ---------------- writes: idempotent, non-destructive ----------------
test("first run adds every sample listing; ops are upserts keyed by demoKey using $setOnInsert only", async () => {
  const env = makeEnv();
  const r = await seed(env);
  const n = buildDemoDocs().length;
  assert.equal(r.inserted, n);
  assert.equal(env.store.size, n);
  assert.equal(env.log.connect, 1);
  assert.equal(env.log.disconnect, 1);
  const { ops } = env.log.calls[0];
  assert.equal(ops.length, n);
  for (const op of ops) {
    assert.deepEqual(Object.keys(op), ["updateOne"], "only updateOne operations");
    assert.deepEqual(Object.keys(op.updateOne.filter), ["demoKey"]);
    assert.equal(op.updateOne.upsert, true);
    assert.deepEqual(Object.keys(op.updateOne.update), ["$setOnInsert"], "never $set: existing records are not modified");
    assert.ok(!("owner" in op.updateOne.update.$setOnInsert));
    assert.equal(op.updateOne.update.$setOnInsert.isDemo, true);
  }
  assert.match(env.log.lines.join(""), new RegExp(`${n} added, 0 already present`));
});

test("re-running is idempotent: nothing duplicated, nothing changed", async () => {
  const env = makeEnv();
  await seed(env);
  const after1 = snap(env.store);
  for (let i = 0; i < 3; i++) {
    const r = await seed(env);
    assert.equal(r.inserted, 0);
    assert.equal(r.existing, buildDemoDocs().length);
  }
  assert.equal(snap(env.store), after1);
  assert.equal(env.store.size, buildDemoDocs().length);
});

test("user-created listings and existing records are preserved exactly (even with similar titles/locations)", async () => {
  const userListings = [
    { _id: "u1", title: "Candolim Beach Villa (Sample)", location: "Candolim, Goa", price: 1, owner: "user-123", description: "mine" },
    { _id: "u2", title: "My Flat", location: "Pune", price: 4000, owner: "user-456", image: { url: "https://res.cloudinary.com/x.png", filename: "wanderlust_DEV/a" } },
    { _id: "u3", title: "Legacy listing without owner", location: "Delhi", price: 100 },
  ];
  const env = makeEnv({ listings: userListings });
  const before = snap(env.store);
  const r = await seed(env);
  assert.equal(r.inserted, buildDemoDocs().length);
  for (const original of userListings) assert.deepEqual(env.store.get(original._id), original, `${original._id} untouched`);
  assert.equal(env.store.size, userListings.length + buildDemoDocs().length);
  assert.ok(snap(env.store).startsWith(before.slice(0, -1)), "pre-existing entries still first and identical");
});

test("an existing demo record that was changed is not overwritten on re-run", async () => {
  const env = makeEnv();
  await seed(env);
  const key = "demo-delhi-01";
  const doc = [...env.store.values()].find((d) => d.demoKey === key);
  doc.price = 99999; doc.title = "Changed by an admin";
  await seed(env);
  const again = [...env.store.values()].find((d) => d.demoKey === key);
  assert.equal(again.price, 99999);
  assert.equal(again.title, "Changed by an admin");
});

test("users are never touched: the script has no user access and the fake Listing exposes only bulkWrite", async () => {
  const env = makeEnv();
  await seed(env);
  assert.deepEqual(Object.keys(env.Listing).sort(), ["bulkWrite", "find"], "only the upsert and a read-only lookup exist");
  const src = fs.readFileSync(path.join(ROOT, "init", "seedDemo.js"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/models\/user|\bUser\b/.test(src), "does not use the User model");
  for (const banned of ["deleteMany", "deleteOne", "updateMany", "findOneAndDelete", ".drop", "dropDatabase", "remove(", "insertMany", "replaceOne"]) {
    assert.ok(!src.includes(banned), `must not use ${banned}`);
  }
  assert.equal(REQUIRED_DB, "elites_hub");
});

test("legacy demo records from the first version are reported but never changed or deleted", async () => {
  const { legacyDemoListings } = require("../init/legacyDemo.js");
  const legacy = legacyDemoListings.map((l, i) => ({ _id: `legacy${i}`, demoKey: l.demoKey, isDemo: true, title: `Old ${l.slug}`, location: l.location, price: 123 }));
  const env = makeEnv({ listings: legacy });
  const before = JSON.stringify(legacy);
  const r = await seed(env);
  assert.equal(r.legacyFound, legacy.length);
  assert.equal(r.inserted, 50, "the new records are still added alongside");
  assert.equal(JSON.stringify(legacy.map((l) => env.store.get(l._id))), before, "legacy records untouched");
  const text = env.log.lines.join("\n");
  assert.match(text, /16 sample listing\(s\) from the previous demo version are still in the database and were NOT changed or deleted/);
  assert.match(text, /Goa/);
  assert.match(text, /Review them before removing anything/);
  // a clean database reports nothing
  const clean = makeEnv();
  assert.equal((await seed(clean)).legacyFound, 0);
  assert.ok(!clean.log.lines.join("\n").includes("previous demo version"));
});

test("a malformed dataset aborts before any connection or write", async () => {
  const demo = require("../init/demoListings.js");
  const removed = demo.demoListings.pop(); // 49 properties: no longer 10 x 5
  try {
    const env = makeEnv();
    await assert.rejects(() => seed(env), /demo dataset is invalid/);
    assert.equal(env.log.connect, 0);
    assert.equal(env.log.calls.length, 0);
  } finally {
    demo.demoListings.push(removed);
  }
});

test("a write error is reported and the connection is still closed", async () => {
  const env = makeEnv();
  env.Listing.bulkWrite = async () => { throw new Error("write failed"); };
  await assert.rejects(() => seed(env), /write failed/);
  assert.equal(env.log.disconnect, 1);
});

// ---------------- command line (never reaches a database) ----------------
const cli = (env, args = []) => spawnSync(process.execPath, ["init/seedDemo.js", ...args], { cwd: ROOT, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("CLI without opt-in exits with an error and prints no connection string", () => {
  const r = cli({ ATLASDB_URL: GOOD_URI });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ALLOW_DEMO_SEED/);
  assert.ok(!(r.stdout + r.stderr).includes("s3cr3tpw"));
});

test("CLI refuses a wrong database name and never prints the connection string", () => {
  const r = cli({ ...OPT_IN, ATLASDB_URL: "mongodb+srv://seeduser:s3cr3tpw@cluster.example.net/test?x=1" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /exactly "elites_hub"/);
  assert.ok(!(r.stdout + r.stderr).includes("s3cr3tpw") && !(r.stdout + r.stderr).includes("cluster.example.net"));
});

test("CLI dry run lists the planned listings, exits 0 and does not connect", () => {
  const r = cli({ ...OPT_IN, ATLASDB_URL: GOOD_URI }, ["--dry-run"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Dry run: would add up to 50 sample listings \(10 cities x 5\) to "elites_hub"/);
  assert.match(r.stdout, /Jaipur:[\s\S]*demo-jaipur-05/);
  assert.ok(!(r.stdout + r.stderr).includes("s3cr3tpw"));
});

test("package.json exposes the seed as `npm run seed:demo`", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["seed:demo"], "node init/seedDemo.js");
});
