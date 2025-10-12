// scripts/seed-personas.js
/**
 * Seed personas and global persona config.
 * Expects data/personas.json:
 * {
 *   "personas": [
 *     { "name":"Elio", "traits":{"humor":0.6,"warmth":0.95,"discipline":0.5}, "likes":["..."], "dislikes":["..."], "openers":["..."] },
 *     ...
 *   ],
 *   "actions": { "joke":{"friendship":2,"trust":0,"dependence":0}, ... },
 *   "modifiers": [ { "persona":"Caleb","action":"help","multiplier":1.5 }, ... ],
 *   "cooldownSeconds": 180
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
  const personasCol = db.collection("personas");
  const configCol = db.collection("persona_config");

  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/personas.json"), "utf-8")
  );
  const { personas, actions, config } = raw;

  for (const p of personas) {
    await personasCol.updateOne(
      { name: p.name },
      {
        $set: {
          name: p.name,
          avatar: p.avatar || null,
          color: Number.isFinite(p.color) ? p.color : null,
          traits: p.traits || {},
          likes: p.likes || [],
          dislikes: p.dislikes || [],
          openers: p.openers || [],
          enabled: true,
        },
      },
      { upsert: true }
    );
  }

  await configCol.updateOne(
    { _id: "global" },
    {
      $set: {
        actions,
        cooldownSeconds: config?.cooldownSeconds ?? 180,
        modifiers: config?.modifiers ?? [],
      },
    },
    { upsert: true }
  );

  console.log("[INT] personas upserted:", personas.length, ", config saved");
  await closeMongo();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
