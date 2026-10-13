// Seed script. DESTRUCTIVE: deletes every document in the `listings` collection before inserting sample data.
// It refuses to run unless explicitly confirmed. Usage (PowerShell):
//   $env:ALLOW_DB_SEED="true"; $env:SEED_OWNER_ID="<_id of an existing user>"; node init/index.js
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;
const ownerId = process.env.SEED_OWNER_ID;

if (process.env.ALLOW_DB_SEED !== "true") {
  console.error(
    "Seeding refused: this script deletes ALL existing listings. Set ALLOW_DB_SEED=true to confirm."
  );
  process.exit(1);
}
if (!MONGO_URL) {
  console.error("Seeding refused: ATLASDB_URL is not set in .env.");
  process.exit(1);
}
if (!/^[0-9a-fA-F]{24}$/.test(ownerId || "")) {
  console.error(
    "Seeding refused: set SEED_OWNER_ID to the _id of an existing user in the target database."
  );
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("connected to DB");
}

const initDB = async () => {
  await Listing.deleteMany({});
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: ownerId,
  }));
  await Listing.insertMany(initData.data);
  console.log("data was initialized");
};

main()
  .then(initDB)
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
