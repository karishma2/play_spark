import "dotenv/config";
import { ensureAuthCollections } from "./auth.js";
import { createMongoClientProvider } from "./db.js";

async function setupAuth() {
  const mongoUri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? "play_spark_dev";
  if (!mongoUri) throw new Error("MONGODB_URI must be configured before setting up authentication");

  const client = await createMongoClientProvider(mongoUri).getClient();
  try {
    await ensureAuthCollections(client.db(databaseName));
    console.log(`Prepared parent authentication collections in ${databaseName}.`);
  } finally {
    await client.close();
  }
}

await setupAuth();
