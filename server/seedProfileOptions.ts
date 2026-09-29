import "dotenv/config";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ensureChildProfileCollections } from "./childProfile.js";
import { createMongoClientProvider } from "./db.js";

const option = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(60),
}).strict();
const uniqueOptions = z.array(option).min(1).superRefine((values, context) => {
  if (new Set(values.map(({ key }) => key)).size !== values.length) {
    context.addIssue({ code: "custom", message: "Profile option keys must be unique" });
  }
});
const contentSchema = z.object({ interests: uniqueOptions, playStyles: uniqueOptions }).strict();

async function seedProfileOptions() {
  const raw = await readFile(new URL("../content/profile-options.json", import.meta.url), "utf8");
  const content = contentSchema.parse(JSON.parse(raw));
  const total = content.interests.length + content.playStyles.length;
  if (process.argv.includes("--validate-only")) {
    console.log(`Validated ${total} profile options.`);
    return;
  }

  const mongoUri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? "play_spark_dev";
  if (!mongoUri) throw new Error("MONGODB_URI must be configured before seeding profile options");

  const client = await createMongoClientProvider(mongoUri).getClient();
  try {
    const db = client.db(databaseName);
    await ensureChildProfileCollections(db);
    const now = new Date();
    await db.collection("profileOptions").updateMany({}, { $set: { enabled: false, updatedAt: now } });
    for (const [kind, values] of [
      ["interest", content.interests],
      ["play_style", content.playStyles],
    ] as const) {
      for (const [index, entry] of values.entries()) {
        await db.collection("profileOptions").updateOne(
          { kind, key: entry.key },
          {
            $set: { label: entry.label, position: index + 1, enabled: true, updatedAt: now },
            $setOnInsert: { kind, key: entry.key, createdAt: now },
          },
          { upsert: true },
        );
      }
    }
    console.log(`Seeded ${total} profile options in ${databaseName}.`);
  } finally {
    await client.close();
  }
}

await seedProfileOptions();
