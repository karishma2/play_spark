import "dotenv/config";
import { createMongoClientProvider } from "./db.js";
import { ensureFeedbackCollections } from "./feedback.js";

const client = await createMongoClientProvider(process.env.MONGODB_URI).getClient();
try {
  await ensureFeedbackCollections(client.db(process.env.MONGODB_DB_NAME ?? "play_spark_dev"));
  console.log("Prepared fixed-choice Play Path feedback storage.");
} finally { await client.close(); }
