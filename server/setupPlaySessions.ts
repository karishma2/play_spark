import "dotenv/config";
import { createMongoClientProvider } from "./db.js";
import { ensurePlaySessionCollections } from "./playSessions.js";

async function setupPlaySessions() {
  const mongoUri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? "play_spark_dev";
  if (!mongoUri) throw new Error("MONGODB_URI must be configured before setting up play sessions");

  const client = await createMongoClientProvider(mongoUri).getClient();
  try {
    await ensurePlaySessionCollections(client.db(databaseName));
    console.log(`Prepared active play-session storage in ${databaseName}.`);
  } finally {
    await client.close();
  }
}

await setupPlaySessions();
