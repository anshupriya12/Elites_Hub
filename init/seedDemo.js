// Adds 50 clearly labelled SAMPLE properties - 5 in each of 10 Indian cities (see demoListings.js). Safe by design:
//   - runs only with an explicit opt-in (ALLOW_DEMO_SEED=true);
//   - refuses unless the database named in ATLASDB_URL is exactly "elites_hub" (checked before connecting, and
//     again on the live connection before anything is written);
//   - only upserts records keyed by their own `demoKey` using $setOnInsert, so re-running never duplicates anything
//     and never modifies an existing record (demo or user-created);
//   - never touches users, never sets an owner, never calls deleteMany/updateMany/drop.
//
// Usage (PowerShell, from the project folder):
//   $env:ALLOW_DEMO_SEED = "true"; npm run seed:demo
// Preview without connecting to anything:
//   $env:ALLOW_DEMO_SEED = "true"; npm run seed:demo -- --dry-run
const path = require("path");
const { buildDemoDocs, demoListings, cities } = require("./demoListings.js");
const { legacyDemoKeys } = require("./legacyDemo.js");

const REQUIRED_DB = "elites_hub";
const PER_CITY = 5;

// The dataset must be exactly 10 cities x 5 unique, owner-less, demo-marked properties.
const assertDemoData = (docs) => {
  const keys = new Set(docs.map((d) => d.demoKey));
  const okShape =
    cities.length === 10 &&
    docs.length === cities.length * PER_CITY &&
    keys.size === docs.length &&
    cities.every((c) => demoListings.filter((d) => d.citySlug === c.slug).length === PER_CITY) &&
    docs.every((d) => d.isDemo === true && !("owner" in d) && /^demo-[a-z0-9-]+$/.test(d.demoKey));
  if (!okShape) throw new Error("The demo dataset is invalid (expected 10 cities x 5 unique demo properties); nothing was written.");
};

class SeedRefusal extends Error {}

// Database name from a MongoDB URI ("" when the URI does not name one).
const parseDatabaseName = (uri) => {
  const m = String(uri || "").match(/^mongodb(?:\+srv)?:\/\/[^/?#]+\/([^?#]*)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch (e) {
    return m[1];
  }
};

async function run({ env = process.env, argv = process.argv.slice(2), mongoose, Listing, log = console.log } = {}) {
  if (env.ALLOW_DEMO_SEED !== "true") {
    throw new SeedRefusal('Refusing to run: set ALLOW_DEMO_SEED="true" to confirm you want to add sample listings.');
  }
  const uri = env.ATLASDB_URL;
  if (!uri) throw new SeedRefusal("Refusing to run: ATLASDB_URL is not set in .env.");
  if (parseDatabaseName(uri) !== REQUIRED_DB) {
    throw new SeedRefusal(
      `Refusing to run: the database named in ATLASDB_URL must be exactly "${REQUIRED_DB}" (add /${REQUIRED_DB} before the "?").`
    );
  }

  const docs = buildDemoDocs();
  assertDemoData(docs);
  if (argv.includes("--dry-run")) {
    log(`Dry run: would add up to ${docs.length} sample listings (${cities.length} cities x ${PER_CITY}) to "${REQUIRED_DB}"; existing ones are left untouched. Nothing is written.`);
    for (const c of cities) {
      log(`  ${c.name}:`);
      demoListings.filter((d) => d.citySlug === c.slug).forEach((d) => log(`    - demo-${d.slug}  |  ${d.title}  |  ${d.location}  |  INR ${d.price}`));
    }
    return { dryRun: true, planned: docs.length, inserted: 0, existing: 0 };
  }

  mongoose = mongoose || require("mongoose");
  Listing = Listing || require("../models/listing.js");
  await mongoose.connect(uri);
  try {
    if (mongoose.connection.name !== REQUIRED_DB) {
      throw new SeedRefusal(`Refusing to write: connected database is "${mongoose.connection.name}", not "${REQUIRED_DB}".`);
    }
    const ops = docs.map(({ demoKey, ...fields }) => ({
      updateOne: {
        filter: { demoKey },
        update: { $setOnInsert: fields },
        upsert: true,
      },
    }));
    const result = await Listing.bulkWrite(ops, { ordered: false });
    const inserted = result.upsertedCount || 0;
    log(`Sample listings: ${inserted} added, ${docs.length - inserted} already present (left unchanged).`);

    // Read-only report: sample listings from the first demo version (some outside the ten cities). Never changed here.
    const legacy = await Listing.find({ demoKey: { $in: legacyDemoKeys } }, { demoKey: 1, location: 1 }).lean();
    if (legacy.length) {
      log(
        `Note: ${legacy.length} sample listing(s) from the previous demo version are still in the database and were NOT changed or deleted: ` +
          legacy.map((l) => l.location || l.demoKey).join("; ") +
          ". Review them before removing anything."
      );
    }
    return { dryRun: false, planned: docs.length, inserted, existing: docs.length - inserted, legacyFound: legacy.length };
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { run, parseDatabaseName, SeedRefusal, REQUIRED_DB };

if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  run().then(
    () => process.exit(0),
    (err) => {
      console.error(err instanceof SeedRefusal ? err.message : `Seeding failed: ${err.message}`);
      process.exit(1);
    }
  );
}
