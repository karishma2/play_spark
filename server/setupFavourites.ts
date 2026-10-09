import "dotenv/config";
import { createMongoClientProvider } from "./db.js";
import { ensureFavouriteCollections } from "./favourites.js";

const client = await createMongoClientProvider(process.env.MONGODB_URI).getClient();
try {
  await ensureFavouriteCollections(client.db(process.env.MONGODB_DB_NAME ?? "play_spark_dev"));
  console.log("Prepared favourite Play Path storage.");
} finally { await client.close(); }
