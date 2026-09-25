import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createAuthRouter, createMongoAuthRepository, type AuthRepository, type PasswordHasher } from "./auth.js";
import { createMongoCatalogRepository, type CatalogRepository } from "./catalog.js";
import { createMongoClientProvider } from "./db.js";
import {
  createResendAuthEmailSender,
  unavailableAuthEmailSender,
  type AuthEmailSender,
} from "./email.js";
import { apiErrorHandler, apiNotFound, createAuthRateLimiter } from "./middleware.js";

export interface CreateAppOptions {
  databaseName: string;
  mongoUri?: string;
  catalog?: CatalogRepository;
  auth?: AuthRepository;
  passwordHasher?: PasswordHasher;
  passwordResetBaseUrl?: string;
  authEmailSender?: AuthEmailSender;
  resendApiKey?: string;
  resendFromEmail?: string;
  authCookieSecure?: boolean;
}

function json(data: unknown) {
  return { data };
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  const mongo = createMongoClientProvider(options.mongoUri);
  const catalog = options.catalog ?? createMongoCatalogRepository(mongo, options.databaseName);
  const auth = options.auth ?? createMongoAuthRepository(mongo, options.databaseName);
  const authEmailSender = options.authEmailSender
    ?? (options.resendApiKey && options.resendFromEmail
      ? createResendAuthEmailSender(options.resendApiKey, options.resendFromEmail)
      : unavailableAuthEmailSender);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  const rateLimitedAuthPaths = [
    "/api/v1/auth/sign-up",
    "/api/v1/auth/sign-in",
    "/api/v1/auth/change-password",
    "/api/v1/auth/request-password-reset",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/request-email-verification",
    "/api/v1/auth/verify-email",
  ];
  for (const path of rateLimitedAuthPaths) {
    app.use(path, createAuthRateLimiter());
  }
  app.use("/api/v1/auth", createAuthRouter({
    repository: auth,
    passwordHasher: options.passwordHasher,
    passwordResetBaseUrl: options.passwordResetBaseUrl ?? "http://localhost:3000",
    authEmailSender,
    cookieSecure: options.authCookieSecure ?? process.env.NODE_ENV === "production",
  }));

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

  app.get("/api/v1/guest/samples", async (_request, response) => {
    try {
      response.json(json(await catalog.listGuestSamples()));
    } catch {
      response.status(503).json({
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "Play Paths are temporarily unavailable. Please try again.",
        },
      });
    }
  });

  app.get("/api/v1/guest/samples/:sampleId", async (request, response) => {
    const params = z.object({ sampleId: z.string().regex(/^[a-f\d]{24}$/iu) }).safeParse(request.params);

    if (!params.success) {
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "This sample Play Path is unavailable.",
        },
      });
      return;
    }

    let sample;
    try {
      sample = await catalog.findGuestSample(params.data.sampleId);
    } catch {
      response.status(503).json({
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "This Play Path is temporarily unavailable. Please try again.",
        },
      });
      return;
    }
    if (!sample) {
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "This sample Play Path is unavailable.",
        },
      });
      return;
    }

    response.json(json(sample));
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
