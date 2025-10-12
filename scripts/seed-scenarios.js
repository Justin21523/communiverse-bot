// scripts/seed-scenarios.js
/**
 * Seed scenario dataset into "scenarios" collection.
 * Expects data/scenarios.json like:
 * {
 *   "scenarios": [
 *     { "prompt":"...", "options":["A","B","C","D"], "correctIndex":1, "tags":["..."], "enabled":true, "weight":1 },
 *     ...
 *   ],
 *   "defaults": { "revealMode":"instant", "pointsOnCorrect":10 } // optional, not stored here
 * }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectMongo, closeMongo, getDb } from "../src/db/mongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await connectMongo();
  const db = getDb();
  const col = db.collection("scenarios");

  const docs = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/scenarios.json"), "utf-8")
  );
  for (const s of docs) {
    await col.updateOne(
      { prompt: s.prompt },
      {
        $set: {
          prompt: s.prompt,
          options: s.options,
          correctIndex: s.correctIndex,
          tags: s.tags || [],
          hostPersonaName: s.hostPersonaName || null,
          enabled: s.enabled !== false,
        },
      },
      { upsert: true }
    );
  }
  console.log("[INT] scenarios inserted:", docs.length);
  await closeMongo();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
