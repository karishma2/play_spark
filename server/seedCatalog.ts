import "dotenv/config";
import { readFile } from "node:fs/promises";
import { ObjectId, type Db, type Document } from "mongodb";
import { z } from "zod";
import { createMongoClientProvider } from "./db.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const eligibility = z.object({
  ageBands: z.array(z.string()).min(1),
  interestKeys: z.array(z.string()).min(1),
  playStyleKeys: z.array(z.string()).min(1),
  energyLevels: z.array(z.string()).min(1),
  noiseLevel: z.string(),
  messLevel: z.string(),
  spaceLevel: z.string(),
  independenceLevel: z.string(),
});
const mission = z.object({
  id: objectId,
  position: z.number().int().positive(),
  wallElementKey: z.string().min(1),
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  setupSteps: z.array(z.string().min(1)).min(1),
  sayThis: z.string().min(1),
  childChallenge: z.string().min(1),
  tidyUp: z.string().min(1),
});
const sample = z.object({
  id: objectId,
  title: z.string().min(1),
  description: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  themeKey: z.string().min(1),
  eligibility,
  guestPreview: z.object({
    position: z.number().int().positive(),
    setupMinutes: z.number().int().nonnegative(),
    parentEffort: z.literal("Low"),
    messLevel: z.enum(["None", "Low"]),
    category: z.string().min(1),
    secondaryCategory: z.string().min(1),
    imageUrl: z.string().url(),
    imageAlt: z.string().min(1),
    materials: z.array(z.string().min(1)).min(1),
    safetyNote: z.string().min(1),
  }),
  wallScene: z.object({
    id: objectId,
    key: z.string().min(1),
    title: z.string().min(1),
    background: z.object({ assetRef: z.string().min(1), alt: z.string().min(1) }),
    elements: z.array(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      revealMessage: z.string().min(1),
      assetRef: z.string().min(1),
      layer: z.number().int().nonnegative(),
    })).min(1),
  }),
  missions: z.array(mission).min(1),
}).superRefine((value, context) => {
  const positions = value.missions.map(({ position }) => position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index + 1)) {
    context.addIssue({ code: "custom", message: "Mission positions must be consecutive from 1" });
  }
  const elementKeys = new Set(value.wallScene.elements.map(({ key }) => key));
  for (const item of value.missions) {
    if (!elementKeys.has(item.wallElementKey)) {
      context.addIssue({ code: "custom", message: `Unknown wall element ${item.wallElementKey}` });
    }
  }
});
const seedSchema = z.object({ samples: z.array(sample).length(2) });

const validators: Record<string, Document> = {
  playPaths: { $jsonSchema: { bsonType: "object", required: ["title", "description", "durationMinutes", "themeKey", "wallSceneId", "eligibility", "status", "contentVersion", "createdAt", "updatedAt"], properties: { status: { enum: ["draft", "published", "retired"] } } } },
  missions: { $jsonSchema: { bsonType: "object", required: ["title", "durationMinutes", "parentEffort", "materials", "setupSteps", "childChallenge", "eligibility", "tagKeys", "status", "contentVersion", "createdAt", "updatedAt"], properties: { status: { enum: ["draft", "published", "retired"] } } } },
  playPathMissions: { $jsonSchema: { bsonType: "object", required: ["playPathId", "missionId", "position", "wallElementKey"] } },
  missionWallScenes: { $jsonSchema: { bsonType: "object", required: ["key", "title", "background", "elements", "status", "createdAt", "updatedAt"], properties: { status: { enum: ["draft", "published", "retired"] } } } },
};

async function ensureCollections(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(validators)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    } else {
      await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    }
  }

  await Promise.all([
    db.collection("playPaths").createIndex({ status: 1, durationMinutes: 1 }),
    db.collection("playPaths").createIndex({ "guestPreview.enabled": 1, "guestPreview.position": 1 }, { unique: true, partialFilterExpression: { "guestPreview.enabled": true } }),
    db.collection("missions").createIndex({ status: 1 }),
    db.collection("playPathMissions").createIndex({ playPathId: 1, position: 1 }, { unique: true }),
    db.collection("missionWallScenes").createIndex({ key: 1 }, { unique: true }),
  ]);
}

async function seed() {
  const raw = await readFile(new URL("../content/guest-samples.json", import.meta.url), "utf8");
  const content = seedSchema.parse(JSON.parse(raw));
  if (process.argv.includes("--validate-only")) {
    console.log(`Validated ${content.samples.length} guest Play Paths.`);
    return;
  }

  const mongoUri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? "play_spark_dev";
  if (!mongoUri) throw new Error("MONGODB_URI must be configured before seeding the catalogue");

  const client = await createMongoClientProvider(mongoUri).getClient();
  try {
    const db = client.db(databaseName);
    await ensureCollections(db);
    const now = new Date();
    const seededPathIds = content.samples.map((entry) => new ObjectId(entry.id));

    // Remove seeded paths from the unique guest-order index before assigning the
    // reviewed positions. This lets two existing samples safely exchange places.
    await db.collection("playPaths").updateMany(
      { _id: { $in: seededPathIds } },
      {
        $set: { "guestPreview.enabled": false },
        $unset: { "guestPreview.position": "" },
      },
    );

    for (const entry of content.samples) {
      const pathId = new ObjectId(entry.id);
      const sceneId = new ObjectId(entry.wallScene.id);
      await db.collection("missionWallScenes").updateOne(
        { _id: sceneId },
        { $set: { key: entry.wallScene.key, title: entry.wallScene.title, background: entry.wallScene.background, elements: entry.wallScene.elements, status: "published", updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      await db.collection("playPaths").updateOne(
        { _id: pathId },
        { $set: { title: entry.title, description: entry.description, durationMinutes: entry.durationMinutes, themeKey: entry.themeKey, wallSceneId: sceneId, eligibility: entry.eligibility, status: "published", contentVersion: 1, guestPreview: { enabled: true, ...entry.guestPreview }, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );

      await db.collection("playPathMissions").deleteMany({ playPathId: pathId });
      for (const item of entry.missions) {
        const missionId = new ObjectId(item.id);
        await db.collection("missions").updateOne(
          { _id: missionId },
          { $set: { title: item.title, durationMinutes: item.durationMinutes, parentEffort: entry.eligibility.independenceLevel, materials: entry.guestPreview.materials.map((name) => ({ name })), setupSteps: item.setupSteps, sayThis: item.sayThis, childChallenge: item.childChallenge, tidyUp: item.tidyUp, eligibility: entry.eligibility, tagKeys: ["indoor", "low_prep", "small_space"], status: "published", contentVersion: 1, updatedAt: now }, $setOnInsert: { createdAt: now } },
          { upsert: true },
        );
        await db.collection("playPathMissions").insertOne({
          playPathId: pathId,
          missionId,
          position: item.position,
          wallElementKey: item.wallElementKey,
          pathOverrides: null,
        });
      }
    }

    console.log(`Seeded ${content.samples.length} guest Play Paths in ${databaseName}.`);
  } finally {
    await client.close();
  }
}

await seed();
