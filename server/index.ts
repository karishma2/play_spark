import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const databaseName = process.env.MONGODB_DB_NAME ?? "play_spark_dev";
const mongoUri = process.env.MONGODB_URI;

let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 8_000,
    });

    clientPromise = client.connect().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

app.use(express.json({ limit: "100kb" }));

app.get("/api/v1/health", (_request, response) => {
  response.json({ data: { service: "play-spark-api", status: "ok" } });
});

app.get("/api/v1/connection-check", async (_request, response) => {
  if (!mongoUri) {
    response.json({ data: { status: "not_configured" } });
    return;
  }

  try {
    const client = await getClient();
    await client.db(databaseName).command({ ping: 1 });
    response.json({ data: { status: "connected" } });
  } catch {
    response.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection check failed.",
      },
    });
  }
});

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(currentDirectory, "../dist");

app.use(express.static(clientDirectory));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDirectory, "index.html"));
});

app.listen(port, () => {
  console.log(`Play Spark is running on port ${port}`);
});
