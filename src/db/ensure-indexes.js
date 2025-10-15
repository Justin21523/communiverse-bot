// /src/db/ensure-indexes.js
// Apply validators & create indexes, with Atlas-safe fallback (skip collMod if forbidden).

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { validators } from "./validators.js";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://communiverse_user:elioversebot@cluster0.1s3kk.mongodb.net/communiverse_bot?retryWrites=true&w=majority&appName=communiverse";
const DB_NAME   = process.env.DB_NAME  || "communiverse_bot";

function isCollModForbidden(e) {
  const s = String(e?.errmsg || e?.message || e || "");
  return s.includes("not allowed to do action [collMod]") || s.includes("collMod") || s.includes("AtlasError");
}

export async function ensureIndexes() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  let validatorsApplied = true;

  // Try apply validators; if collMod forbidden, skip but ensure collections exist.
  for (const [name, validator] of Object.entries(validators)) {
    try {
      const exists = await db.listCollections({ name }).hasNext();
      if (exists) {
        await db.command({ collMod: name, validator });
      } else {
        await db.createCollection(name, { validator });
      }
    } catch (e) {
      if (isCollModForbidden(e)) {
        console.warn(`[JOB] validator skipped for ${name}: collMod forbidden on this user/cluster`);
        validatorsApplied = false;
        // Ensure collection exists even if validator skipped
        const exists = await db.listCollections({ name }).hasNext();
        if (!exists) await db.createCollection(name);
      } else {
        console.error("[ERR] ensureIndexes validator error:", e);
        throw e;
      }
    }
  }

  // Indexes (safe even if validators skipped)
  // personas
  await db.collection("personas").createIndex({ name: 1 }, { unique: true });
  await db.collection("personas").createIndex({ enabled: 1 });

  // scenarios: unique prompt only when prompt is a string (avoid null duplicates)
  await db.collection("scenarios").createIndex(
    { prompt: 1 },
    { unique: true, partialFilterExpression: { prompt: { $type: "string" } } }
  );
  await db.collection("scenarios").createIndex({ enabled: 1, weight: -1 });
  await db.collection("scenarios").createIndex({ tags: 1 });
  // ---- RECOMMENDED for scenario speed-quiz (one answer per user) ----
  // scenario sessions/answers
  await db.collection('scenario_sessions').createIndex({ guildId: 1, channelId: 1, active: 1 });
  await db.collection('scenario_answers').createIndex({ sessionId: 1, userId: 1 }, { unique: true });
  await db.collection('scenario_answers').createIndex({ sessionId: 1, createdAt: 1 });

  // greetings
  await db.collection("greetings").createIndex({ enabled: 1, weight: -1 });
  await db.collection("greetings").createIndex({ personaHost: 1 });
  await db.collection("greetings").createIndex({ tags: 1 }, { sparse: true });

  // media
  await db.collection('media').createIndex({ enabled: 1, nsfw: 1 });
  await db.collection('media').createIndex({ tags: 1 });
  await db.collection('media').createIndex({ addedAt: -1 });

  // schedules
  await db.collection('schedules').createIndex({ guildId: 1, kind: 1 }, { unique: true });
  await db.collection('schedules').createIndex({ enabled: 1 });
  await db.collection('schedules').createIndex({ channelId: 1 });

  // One profile per (guildId, userId), and fast sort by points desc for leaderboard.
  await db.collection('profiles').createIndex({ guildId: 1, userId: 1 }, { unique: true });
  await db.collection('profiles').createIndex({ guildId: 1, points: -1, updatedAt: -1 });

  console.log(`[JOB] indexes ensured (validators ${validatorsApplied ? "applied" : "skipped"})`);
  await client.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureIndexes().catch((e) => {
    console.error("[ERR] ensureIndexes failed:", e);
    process.exit(1);
  });
}
