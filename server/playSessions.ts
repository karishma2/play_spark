import { MongoServerError, ObjectId, type Db, type Document } from "mongodb";
import { Router, type Response } from "express";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository } from "./auth.js";
import type { GuestSample, CatalogRepository } from "./catalog.js";
import type { ChildProfileRepository } from "./childProfile.js";
import type { MongoClientProvider } from "./db.js";

export type PlaySessionStatus = "active" | "completed" | "abandoned";

export interface PlaySession {
  id: string;
  childProfileId: string;
  status: PlaySessionStatus;
  playPath: GuestSample;
  completedMissionIds: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  abandonedAt?: string;
}

export interface PlaySessionRepository {
  findActive(userId: string, childProfileId: string): Promise<PlaySession | null>;
  findOwned(sessionId: string, userId: string): Promise<PlaySession | null>;
  create(userId: string, childProfileId: string, playPath: GuestSample): Promise<PlaySession>;
  recordMissionCompletion(
    sessionId: string,
    userId: string,
    previousMissionIds: string[],
    missionId: string,
    completesSession: boolean,
  ): Promise<PlaySession | null>;
  abandon(sessionId: string, userId: string, childProfileId: string): Promise<PlaySession | null>;
}

export class ActivePlaySessionExistsError extends Error {}

interface PlaySessionDocument extends Document {
  _id?: ObjectId;
  userId: ObjectId;
  childProfileId: ObjectId;
  status: PlaySessionStatus;
  playPath: GuestSample;
  completedMissionIds: string[];
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  abandonedAt?: Date;
}

const playSessionDocument = {
  bsonType: "object",
  required: ["userId", "childProfileId", "status", "playPath", "completedMissionIds", "startedAt", "updatedAt"],
  properties: {
    userId: { bsonType: "objectId" },
    childProfileId: { bsonType: "objectId" },
    status: { enum: ["active", "completed", "abandoned"] },
    playPath: { bsonType: "object" },
    completedMissionIds: { bsonType: "array", uniqueItems: true, items: { bsonType: "string" } },
    startedAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    completedAt: { bsonType: "date" },
    abandonedAt: { bsonType: "date" },
  },
};

export async function ensurePlaySessionCollections(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  if (existing.has("playSessions")) {
    await db.command({ collMod: "playSessions", validator: { $jsonSchema: playSessionDocument }, validationLevel: "strict", validationAction: "error" });
  } else {
    await db.createCollection("playSessions", { validator: { $jsonSchema: playSessionDocument }, validationLevel: "strict", validationAction: "error" });
  }
  await Promise.all([
    db.collection("playSessions").createIndex(
      { childProfileId: 1, status: 1 },
      { unique: true, partialFilterExpression: { status: "active" } },
    ),
    db.collection("playSessions").createIndex({ userId: 1, updatedAt: -1 }),
  ]);
}

function toPlaySession(document: PlaySessionDocument): PlaySession {
  if (!document._id) throw new Error("Play session is missing its identifier");
  return {
    id: document._id.toHexString(),
    childProfileId: document.childProfileId.toHexString(),
    status: document.status,
    playPath: document.playPath,
    completedMissionIds: document.completedMissionIds,
    startedAt: document.startedAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    ...(document.completedAt ? { completedAt: document.completedAt.toISOString() } : {}),
    ...(document.abandonedAt ? { abandonedAt: document.abandonedAt.toISOString() } : {}),
  };
}

export function createMongoPlaySessionRepository(
  mongo: MongoClientProvider,
  databaseName: string,
): PlaySessionRepository {
  async function collection() {
    return (await mongo.getClient()).db(databaseName).collection<PlaySessionDocument>("playSessions");
  }

  return {
    async findActive(userId, childProfileId) {
      if (!ObjectId.isValid(userId) || !ObjectId.isValid(childProfileId)) return null;
      const document = await (await collection()).findOne({
        userId: new ObjectId(userId),
        childProfileId: new ObjectId(childProfileId),
        status: "active",
      });
      return document ? toPlaySession(document) : null;
    },
    async findOwned(sessionId, userId) {
      if (!ObjectId.isValid(sessionId) || !ObjectId.isValid(userId)) return null;
      const document = await (await collection()).findOne({ _id: new ObjectId(sessionId), userId: new ObjectId(userId) });
      return document ? toPlaySession(document) : null;
    },
    async create(userId, childProfileId, playPath) {
      const now = new Date();
      try {
        const result = await (await collection()).insertOne({
          userId: new ObjectId(userId),
          childProfileId: new ObjectId(childProfileId),
          status: "active",
          playPath,
          completedMissionIds: [],
          startedAt: now,
          updatedAt: now,
        });
        return {
          id: result.insertedId.toHexString(),
          childProfileId,
          status: "active",
          playPath,
          completedMissionIds: [],
          startedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) throw new ActivePlaySessionExistsError();
        throw error;
      }
    },
    async recordMissionCompletion(sessionId, userId, previousMissionIds, missionId, completesSession) {
      if (!ObjectId.isValid(sessionId) || !ObjectId.isValid(userId)) return null;
      const now = new Date();
      const document = await (await collection()).findOneAndUpdate(
        {
          _id: new ObjectId(sessionId),
          userId: new ObjectId(userId),
          status: "active",
          completedMissionIds: previousMissionIds,
        },
        {
          $set: {
            completedMissionIds: [...previousMissionIds, missionId],
            status: completesSession ? "completed" : "active",
            updatedAt: now,
            ...(completesSession ? { completedAt: now } : {}),
          },
        },
        { returnDocument: "after" },
      );
      return document ? toPlaySession(document) : null;
    },
    async abandon(sessionId, userId, childProfileId) {
      if (!ObjectId.isValid(sessionId) || !ObjectId.isValid(userId) || !ObjectId.isValid(childProfileId)) return null;
      const now = new Date();
      const document = await (await collection()).findOneAndUpdate(
        {
          _id: new ObjectId(sessionId),
          userId: new ObjectId(userId),
          childProfileId: new ObjectId(childProfileId),
          status: "active",
        },
        { $set: { status: "abandoned", abandonedAt: now, updatedAt: now } },
        { returnDocument: "after" },
      );
      return document ? toPlaySession(document) : null;
    },
  };
}

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const startSchema = z.object({ playPathId: objectId }).strict();

function safeError(response: Response) {
  response.status(503).json({ error: { code: "PLAY_SESSION_UNAVAILABLE", message: "Your play session is temporarily unavailable. Please try again." } });
}

export function createPlaySessionRouter(options: {
  repository: PlaySessionRepository;
  authRepository: AuthRepository;
  childProfiles: ChildProfileRepository;
  catalog: CatalogRepository;
  requireEmailVerification: boolean;
}) {
  const router = Router();

  async function context(request: Parameters<typeof findAuthenticatedUser>[0], response: Response) {
    const user = await findAuthenticatedUser(request, options.authRepository);
    if (!user) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
      return null;
    }
    if (options.requireEmailVerification && !user.emailVerified) {
      response.status(403).json({ error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email to start an activity." } });
      return null;
    }
    const profile = await options.childProfiles.findActiveByUserId(user.id);
    if (!profile) {
      response.status(409).json({ error: { code: "CHILD_PROFILE_REQUIRED", message: "Create a child profile before starting an activity." } });
      return null;
    }
    return { user, profile };
  }

  router.get("/play-sessions/active", async (request, response) => {
    try {
      const owner = await context(request, response);
      if (!owner) return;
      response.json({ data: await options.repository.findActive(owner.user.id, owner.profile.id) });
    } catch {
      safeError(response);
    }
  });

  router.post("/play-sessions", async (request, response) => {
    const input = startSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid Play Path." } });
      return;
    }
    try {
      const owner = await context(request, response);
      if (!owner) return;
      const active = await options.repository.findActive(owner.user.id, owner.profile.id);
      if (active) {
        if (active.playPath.id === input.data.playPathId) response.json({ data: active });
        else response.status(409).json({ error: { code: "ACTIVE_SESSION_EXISTS", message: "Finish or end the current Play Path before starting another." } });
        return;
      }
      const playPath = await options.catalog.findPublishedPlayPath(input.data.playPathId);
      if (!playPath) {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "This Play Path is unavailable." } });
        return;
      }
      try {
        const created = await options.repository.create(owner.user.id, owner.profile.id, playPath);
        response.status(201).json({ data: created });
      } catch (error) {
        if (!(error instanceof ActivePlaySessionExistsError)) throw error;
        const concurrent = await options.repository.findActive(owner.user.id, owner.profile.id);
        if (concurrent?.playPath.id === input.data.playPathId) {
          response.status(200).json({ data: concurrent });
          return;
        }
        response.status(409).json({ error: { code: "ACTIVE_SESSION_EXISTS", message: "Finish or end the current Play Path before starting another." } });
      }
    } catch (error) {
      safeError(response);
    }
  });

  router.post("/play-sessions/:sessionId/missions/:missionId/complete", async (request, response) => {
    const params = z.object({ sessionId: objectId, missionId: objectId }).safeParse(request.params);
    if (!params.success) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "This play session is unavailable." } });
      return;
    }
    try {
      const owner = await context(request, response);
      if (!owner) return;
      const session = await options.repository.findOwned(params.data.sessionId, owner.user.id);
      if (!session || session.childProfileId !== owner.profile.id) {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "This play session is unavailable." } });
        return;
      }
      if (session.completedMissionIds.includes(params.data.missionId)) {
        response.json({ data: session });
        return;
      }
      if (session.status !== "active") {
        response.status(409).json({ error: { code: "SESSION_NOT_ACTIVE", message: "This Play Path is no longer active." } });
        return;
      }
      const nextMission = session.playPath.missions[session.completedMissionIds.length];
      if (!nextMission || nextMission.id !== params.data.missionId) {
        response.status(409).json({ error: { code: "MISSION_OUT_OF_ORDER", message: "Complete the current mission before moving ahead." } });
        return;
      }
      const updated = await options.repository.recordMissionCompletion(
        session.id,
        owner.user.id,
        session.completedMissionIds,
        nextMission.id,
        session.completedMissionIds.length + 1 === session.playPath.missions.length,
      );
      if (!updated) {
        const latest = await options.repository.findOwned(session.id, owner.user.id);
        if (latest?.childProfileId === owner.profile.id && latest.completedMissionIds.includes(nextMission.id)) {
          response.json({ data: latest });
          return;
        }
        response.status(409).json({ error: { code: "SESSION_CHANGED", message: "Your progress changed in another window. Refresh and try again." } });
        return;
      }
      response.json({ data: updated });
    } catch {
      safeError(response);
    }
  });

  router.post("/play-sessions/:sessionId/abandon", async (request, response) => {
    const params = z.object({ sessionId: objectId }).safeParse(request.params);
    if (!params.success) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "This play session is unavailable." } });
      return;
    }
    try {
      const owner = await context(request, response);
      if (!owner) return;
      const session = await options.repository.abandon(params.data.sessionId, owner.user.id, owner.profile.id);
      if (!session) {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "This active play session is unavailable." } });
        return;
      }
      response.json({ data: session });
    } catch {
      safeError(response);
    }
  });

  return router;
}
