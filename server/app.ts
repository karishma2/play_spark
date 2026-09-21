import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMongoClientProvider } from "./db.js";
import { apiErrorHandler, apiNotFound, createAuthRateLimiter } from "./middleware.js";

export interface CreateAppOptions {
  databaseName: string;
  mongoUri?: string;
}

function json(data: unknown) {
  return { data };
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  const mongo = createMongoClientProvider(options.mongoUri);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1/auth", createAuthRateLimiter());

  app.get("/api/v1/health", (_request, response) => {
    response.json(json({ service: "play-spark-api", status: "ok" }));
  });

  app.get("/api/v1/connection-check", async (_request, response) => {
    if (!options.mongoUri) {
      response.json(json({ status: "not_configured" }));
      return;
    }

    try {
      const client = await mongo.getClient();
      await client.db(options.databaseName).command({ ping: 1 });
      response.json(json({ status: "connected" }));
    } catch {
      response.status(503).json({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database connection check failed.",
        },
      });
    }
  });

  app.use("/api", apiNotFound);

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const clientDirectory = path.resolve(currentDirectory, "../dist");
  app.use(express.static(clientDirectory));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(clientDirectory, "index.html"));
  });

  app.use(apiErrorHandler);
  return app;
}
