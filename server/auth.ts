import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Db, Document } from "mongodb";
import { MongoServerError, ObjectId } from "mongodb";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { MongoClientProvider } from "./db.js";

const sessionCookieName = "play_spark_session";
const sessionLifetimeMs = 14 * 24 * 60 * 60 * 1000;
const scryptParameters = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  hasChildProfile: boolean;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(email: string, passwordHash: string): Promise<AuthUser>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserBySession(tokenHash: string, now: Date): Promise<AuthUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

export class EmailAlreadyExistsError extends Error {}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, scryptParameters, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export const scryptPasswordHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    return `scrypt$${scryptParameters.N}$${scryptParameters.r}$${scryptParameters.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  },
  async verify(password, encodedHash) {
    const [algorithm, rawN, rawR, rawP, rawSalt, rawKey] = encodedHash.split("$");
    if (algorithm !== "scrypt" || !rawN || !rawR || !rawP || !rawSalt || !rawKey) return false;
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);
    if (N !== scryptParameters.N || r !== scryptParameters.r || p !== scryptParameters.p) return false;
    try {
      const expected = Buffer.from(rawKey, "base64url");
      const actual = await deriveKey(password, Buffer.from(rawSalt, "base64url"));
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  },
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function publicSession(user: AuthUser) {
  return { user: { id: user.id, email: user.email }, hasChildProfile: user.hasChildProfile };
}

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform(normalizeEmail),
  password: z.string().min(10).max(128),
}).strict();

const validators: Record<string, Document> = {
  users: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "passwordHash", "status", "createdAt", "updatedAt"],
      properties: {
        email: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        status: { enum: ["active", "deletion_pending"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        lastSignedInAt: { bsonType: "date" },
      },
    },
  },
  authSessions: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "tokenHash", "expiresAt", "createdAt"],
      properties: {
        userId: { bsonType: "objectId" },
        tokenHash: { bsonType: "string" },
        expiresAt: { bsonType: "date" },
        createdAt: { bsonType: "date" },
        lastSeenAt: { bsonType: "date" },
      },
    },
  },
};

export async function ensureAuthCollections(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(validators)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    } else {
      await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    }
  }
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("authSessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("authSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("authSessions").createIndex({ userId: 1 }),
  ]);
}

export function createMongoAuthRepository(mongo: MongoClientProvider, databaseName: string): AuthRepository {
  let readyPromise: Promise<Db> | undefined;
  async function ready() {
    if (!readyPromise) {
      readyPromise = mongo.getClient().then((client) => client.db(databaseName)).catch((error: unknown) => {
        readyPromise = undefined;
        throw error;
      });
    }
    return readyPromise;
  }

  async function toAuthUser(document: Document, db: Db): Promise<AuthUser> {
    const hasChildProfile = await db.collection("childProfiles").countDocuments(
      { userId: document._id, isActive: true },
      { limit: 1 },
    ) > 0;
    return {
      id: document._id.toHexString(),
      email: document.email,
      passwordHash: document.passwordHash,
      hasChildProfile,
    };
  }

  return {
    async findUserByEmail(email) {
      const db = await ready();
      const user = await db.collection("users").findOne({ email, status: "active" });
      return user ? toAuthUser(user, db) : null;
    },
    async createUser(email, passwordHash) {
      const db = await ready();
      const now = new Date();
      try {
        const result = await db.collection("users").insertOne({
          email,
          passwordHash,
          status: "active",
          createdAt: now,
          updatedAt: now,
          lastSignedInAt: now,
        });
        return { id: result.insertedId.toHexString(), email, passwordHash, hasChildProfile: false };
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) throw new EmailAlreadyExistsError();
        throw error;
      }
    },
    async createSession(userId, tokenHash, expiresAt) {
      const db = await ready();
      const now = new Date();
      await db.collection("authSessions").insertOne({
        userId: new ObjectId(userId), tokenHash, expiresAt, createdAt: now, lastSeenAt: now,
      });
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: { lastSignedInAt: now, updatedAt: now } },
      );
    },
    async findUserBySession(tokenHash, now) {
      const db = await ready();
      const session = await db.collection("authSessions").findOne({ tokenHash, expiresAt: { $gt: now } });
      if (!session) return null;
      const user = await db.collection("users").findOne({ _id: session.userId, status: "active" });
      if (!user) return null;
      await db.collection("authSessions").updateOne({ _id: session._id }, { $set: { lastSeenAt: now } });
      return toAuthUser(user, db);
    },
    async deleteSession(tokenHash) {
      const db = await ready();
      await db.collection("authSessions").deleteOne({ tokenHash });
    },
  };
}

function readCookie(request: Request) {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === sessionCookieName) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return undefined; }
    }
  }
  return undefined;
}

function validationError(response: Response, result: z.ZodSafeParseError<unknown>) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "request");
    if (!fieldErrors[field]) {
      fieldErrors[field] = field === "email"
        ? "Enter a valid email address."
        : "Use a password between 10 and 128 characters.";
    }
  }
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields.", fieldErrors } });
}

export function createAuthRouter(options: {
  repository: AuthRepository;
  cookieSecure: boolean;
  passwordHasher?: PasswordHasher;
}) {
  const router = Router();
  const passwordHasher = options.passwordHasher ?? scryptPasswordHasher;
  const cookieOptions = {
    httpOnly: true,
    secure: options.cookieSecure,
    sameSite: "lax" as const,
    maxAge: sessionLifetimeMs,
    path: "/",
  };
  const clearCookieOptions = {
    httpOnly: true,
    secure: options.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
  };

  async function startSession(response: Response, user: AuthUser) {
    const token = randomBytes(32).toString("base64url");
    await options.repository.createSession(user.id, hashSessionToken(token), new Date(Date.now() + sessionLifetimeMs));
    response.cookie(sessionCookieName, token, cookieOptions);
  }

  router.post("/sign-up", async (request, response) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    try {
      const passwordHash = await passwordHasher.hash(parsed.data.password);
      const user = await options.repository.createUser(parsed.data.email, passwordHash);
      await startSession(response, user);
      response.status(201).json({ data: publicSession(user) });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        response.status(409).json({ error: { code: "CONFLICT", message: "An account with this email already exists." } });
        return;
      }
      response.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "Account access is temporarily unavailable. Please try again." } });
    }
  });

  router.post("/sign-in", async (request, response) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed);
    try {
      const user = await options.repository.findUserByEmail(parsed.data.email);
      const valid = user
        ? await passwordHasher.verify(parsed.data.password, user.passwordHash)
        : await passwordHasher.hash(parsed.data.password).then(() => false);
      if (!user || !valid) {
        response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Email or password is incorrect." } });
        return;
      }
      await startSession(response, user);
      response.json({ data: publicSession(user) });
    } catch {
      response.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "Account access is temporarily unavailable. Please try again." } });
    }
  });

  router.get("/session", async (request, response) => {
    const token = readCookie(request);
    if (!token) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
      return;
    }
    try {
      const user = await options.repository.findUserBySession(hashSessionToken(token), new Date());
      if (!user) {
        response.clearCookie(sessionCookieName, clearCookieOptions);
        response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
        return;
      }
      response.json({ data: publicSession(user) });
    } catch {
      response.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "Account access is temporarily unavailable. Please try again." } });
    }
  });

  router.post("/sign-out", async (request, response) => {
    const token = readCookie(request);
    if (!token) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
      return;
    }
    try {
      await options.repository.deleteSession(hashSessionToken(token));
      response.clearCookie(sessionCookieName, clearCookieOptions);
      response.json({ data: { signedOut: true } });
    } catch {
      response.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "Account access is temporarily unavailable. Please try again." } });
    }
  });

  return router;
}
