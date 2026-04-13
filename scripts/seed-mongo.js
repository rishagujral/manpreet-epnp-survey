const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const responsesFile = path.join(__dirname, "..", "data", "responses.json");

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGO_URI in .env first");
    process.exit(1);
  }

  let responses = [];
  try {
    responses = JSON.parse(fs.readFileSync(responsesFile, "utf8"));
  } catch {
    console.error("No local responses.json found");
    process.exit(1);
  }

  if (!responses.length) {
    console.log("No responses to migrate");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("epnp_csat");
  const col = db.collection("responses");

  const existing = await col.countDocuments();
  console.log(`MongoDB already has ${existing} responses`);

  const existingIds = new Set(
    (await col.find({}, { projection: { id: 1 } }).toArray()).map((r) => r.id)
  );

  const newResponses = responses.filter((r) => !existingIds.has(r.id));
  if (newResponses.length === 0) {
    console.log("All local responses already exist in MongoDB — nothing to migrate");
  } else {
    await col.insertMany(newResponses);
    console.log(`Migrated ${newResponses.length} new responses to MongoDB`);
  }

  await client.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
