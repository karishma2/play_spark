import { Router, type Response } from "express";
import { MongoServerError, ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository } from "./auth.js";
import type { CatalogRepository } from "./catalog.js";
import type { MongoClientProvider } from "./db.js";

export interface FavouriteRecord { id: string; playPathId: string; createdAt: string }
export interface FavouriteRepository {
  list(userId: string, limit: number, before?: string): Promise<FavouriteRecord[]>;
  has(userId: string, playPathId: string): Promise<boolean>;
  save(userId: string, playPathId: string): Promise<void>;
  remove(userId: string, playPathId: string): Promise<void>;
}
interface FavouriteDocument { _id: ObjectId; userId: ObjectId; playPathId: ObjectId; createdAt: Date }

export async function ensureFavouriteCollections(db: Db) {
  const validator = { $jsonSchema: { bsonType: "object", required: ["userId", "playPathId", "createdAt"], properties: {
    userId: { bsonType: "objectId" }, playPathId: { bsonType: "objectId" }, createdAt: { bsonType: "date" },
  } } };
  if ((await db.listCollections({ name: "favoritePlayPaths" }).toArray()).length) {
    await db.command({ collMod: "favoritePlayPaths", validator });
  } else { await db.createCollection("favoritePlayPaths", { validator }); }
  await db.collection("favoritePlayPaths").createIndex({ userId: 1, playPathId: 1 }, { unique: true });
  await db.collection("favoritePlayPaths").createIndex({ userId: 1, _id: -1 });
}

export function createMongoFavouriteRepository(mongo: MongoClientProvider, databaseName: string): FavouriteRepository {
  // Establish uniqueness before any upsert, including deployments not yet running the setup command.
  let ready: Promise<void> | undefined;
  async function collection() {
    const rows = (await mongo.getClient()).db(databaseName).collection<FavouriteDocument>("favoritePlayPaths");
    ready ??= rows.createIndex({ userId: 1, playPathId: 1 }, { unique: true }).then(() => undefined).catch((error: unknown) => {
      ready = undefined; throw error;
    });
    await ready;
    return rows;
  }
  return {
    async list(userId, limit, before) {
      const rows = await (await collection()).find({ userId: new ObjectId(userId), ...(before ? { _id: { $lt: new ObjectId(before) } } : {}) })
        .sort({ _id: -1 }).limit(limit).toArray();
      return rows.map((row) => ({ id: row._id.toHexString(), playPathId: row.playPathId.toHexString(), createdAt: row.createdAt.toISOString() }));
    },
    async has(userId, playPathId) { return Boolean(await (await collection()).findOne({ userId: new ObjectId(userId), playPathId: new ObjectId(playPathId) })); },
    async save(userId, playPathId) {
      const rows = await collection();
      const ownerAndPath = { userId: new ObjectId(userId), playPathId: new ObjectId(playPathId) };
      try {
        await rows.updateOne(ownerAndPath, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      } catch (error) {
        // A concurrent first save can win the unique index race. Only treat it
        // as successful after confirming this exact owner's bookmark exists.
        if (!(error instanceof MongoServerError && error.code === 11000 && await rows.findOne(ownerAndPath))) throw error;
      }
    },
    async remove(userId, playPathId) { await (await collection()).deleteOne({ userId: new ObjectId(userId), playPathId: new ObjectId(playPathId) }); },
  };
}

export function createFavouriteRouter(options: { repository: FavouriteRepository; authRepository: AuthRepository; catalog: CatalogRepository; requireEmailVerification: boolean }) {
  const router = Router();
  const id = z.string().regex(/^[a-f\d]{24}$/iu).transform((value) => value.toLowerCase());
  function unavailable(response: Response) { response.status(503).json({ error: { code: "FAVOURITES_UNAVAILABLE", message: "Your favourites are temporarily unavailable. Please try again." } }); }
  async function owner(request: Parameters<typeof findAuthenticatedUser>[0], response: Response) {
    const user = await findAuthenticatedUser(request, options.authRepository);
    if (!user) { response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } }); return null; }
    if (options.requireEmailVerification && !user.emailVerified) {
      response.status(403).json({ error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email to save activities." } }); return null;
    }
    return user;
  }
  router.get("/favourites", async (request, response) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(20).default(10), before: id.optional() }).strict().safeParse(request.query);
    if (!query.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid favourites page." } }); return; }
    try {
      const user = await owner(request, response); if (!user) return;
      const rows = await options.repository.list(user.id, query.data.limit + 1, query.data.before);
      const page = rows.slice(0, query.data.limit);
      const playPaths = await Promise.all(page.map(async (row) => {
        const path = await options.catalog.findPublishedPlayPath(row.playPathId);
        // Return card metadata only; unavailable paths remain removable without exposing retired content.
        return { ...row, activity: path ? { id: path.id, title: path.title, summary: path.summary, durationMinutes: path.durationMinutes, imageUrl: path.imageUrl, imageAlt: path.imageAlt } : null };
      }));
      response.json({ data: { playPaths, nextCursor: rows.length > query.data.limit ? page.at(-1)?.id ?? null : null } });
    } catch { unavailable(response); }
  });
  router.route("/favourites/play-paths/:playPathId")
    .all(async (request, response, next) => {
      const parsed = id.safeParse(request.params.playPathId);
      if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid Play Path." } }); return; }
      request.params.playPathId = parsed.data;
      next();
    })
    .get(async (request, response) => {
      try { const user = await owner(request, response); if (!user) return;
        response.json({ data: { saved: await options.repository.has(user.id, String(request.params.playPathId)) } });
      } catch { unavailable(response); }
    })
    .put(async (request, response) => {
      if (!z.object({}).strict().safeParse(request.body ?? {}).success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No additional fields are needed to save a Play Path." } }); return; }
      try { const user = await owner(request, response); if (!user) return;
        const pathId = String(request.params.playPathId);
        if (!await options.catalog.findPublishedPlayPath(pathId)) { response.status(404).json({ error: { code: "NOT_FOUND", message: "This Play Path is no longer available." } }); return; }
        await options.repository.save(user.id, pathId); response.json({ data: { saved: true } });
      } catch { unavailable(response); }
    })
    .delete(async (request, response) => {
      try { const user = await owner(request, response); if (!user) return;
        await options.repository.remove(user.id, String(request.params.playPathId)); response.json({ data: { saved: false } });
      } catch { unavailable(response); }
    });
  return router;
}
