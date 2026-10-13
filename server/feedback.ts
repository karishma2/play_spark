import { Router } from "express";
import { MongoServerError, ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository } from "./auth.js";
import type { ChildProfileRepository } from "./childProfile.js";
import type { MongoClientProvider } from "./db.js";
import type { PlaySessionRepository } from "./playSessions.js";

export const feedbackReasons = ["too_easy", "too_difficult", "too_messy", "lost_interest", "not_suitable"] as const;
const feedbackSchema = z.object({
  overallRating: z.enum(["loved_it", "okay"]).nullable(),
  reasonKeys: z.array(z.enum(feedbackReasons)).max(5).refine((keys) => new Set(keys).size === keys.length),
}).strict().refine((value) => value.overallRating !== null || value.reasonKeys.length > 0);
export type PlayFeedback = z.infer<typeof feedbackSchema>;
export interface FeedbackRepository {
  find(sessionId: string, userId: string): Promise<PlayFeedback | null>;
  save(sessionId: string, userId: string, playPathId: string, feedback: PlayFeedback): Promise<void>;
}
interface FeedbackDocument extends PlayFeedback {
  playSessionId: ObjectId; userId: ObjectId; playPathId: ObjectId; createdAt: Date;
}
export async function ensureFeedbackCollections(db: Db) {
  const validator = { $jsonSchema: { bsonType: "object", required: ["playSessionId", "userId", "playPathId", "overallRating", "reasonKeys", "createdAt"], properties: {
    playSessionId: { bsonType: "objectId" }, userId: { bsonType: "objectId" }, playPathId: { bsonType: "objectId" },
    overallRating: { enum: ["loved_it", "okay", null] },
    reasonKeys: { bsonType: "array", uniqueItems: true, maxItems: 5, items: { enum: feedbackReasons } }, createdAt: { bsonType: "date" },
  } } };
  if ((await db.listCollections({ name: "feedback" }).toArray()).length) await db.command({ collMod: "feedback", validator });
  else await db.createCollection("feedback", { validator });
  await db.collection("feedback").createIndex({ playSessionId: 1 }, { unique: true });
}
export function createMongoFeedbackRepository(mongo: MongoClientProvider, databaseName: string): FeedbackRepository {
  let ready: Promise<void> | undefined;
  async function collection() {
    const rows = (await mongo.getClient()).db(databaseName).collection<FeedbackDocument>("feedback");
    ready ??= rows.createIndex({ playSessionId: 1 }, { unique: true }).then(() => undefined).catch((error: unknown) => { ready = undefined; throw error; });
    await ready;
    return rows;
  }
  return {
    async find(sessionId, userId) {
      const row = await (await collection()).findOne({ playSessionId: new ObjectId(sessionId), userId: new ObjectId(userId) });
      return row ? { overallRating: row.overallRating, reasonKeys: row.reasonKeys } : null;
    },
    async save(sessionId, userId, playPathId, feedback) {
      const rows = await collection();
      const owner = { playSessionId: new ObjectId(sessionId), userId: new ObjectId(userId) };
      const update = { $set: feedback, $setOnInsert: { playPathId: new ObjectId(playPathId), createdAt: new Date() } };
      try { await rows.updateOne(owner, update, { upsert: true }); }
      catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
        const retried = await rows.updateOne(owner, { $set: feedback });
        if (!retried.matchedCount) throw error;
      }
    },
  };
}
function unavailable(response: import("express").Response) {
  response.status(503).json({ error: { code: "FEEDBACK_UNAVAILABLE", message: "Feedback is temporarily unavailable. Please try again." } });
}
export function createFeedbackRouter(options: {
  repository: FeedbackRepository; auth: AuthRepository; profiles: ChildProfileRepository;
  sessions: PlaySessionRepository; requireEmailVerification: boolean;
}) {
  const router = Router();
  router.route("/play-sessions/:sessionId/feedback").all(async (request, response, next) => {
    if (!z.string().regex(/^[a-f\d]{24}$/iu).safeParse(request.params.sessionId).success) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "This completed activity is unavailable." } }); return;
    }
    try {
      const user = await findAuthenticatedUser(request, options.auth);
      if (!user) { response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } }); return; }
      if (options.requireEmailVerification && !user.emailVerified) {
        response.status(403).json({ error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email to share feedback." } }); return;
      }
      const profile = await options.profiles.findActiveByUserId(user.id);
      const session = await options.sessions.findOwned(request.params.sessionId, user.id);
      if (!profile || !session || session.childProfileId !== profile.id || session.status !== "completed") {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "This completed activity is unavailable." } }); return;
      }
      response.locals.feedbackOwner = { userId: user.id, sessionId: session.id, playPathId: session.playPath.id };
      next();
    } catch { unavailable(response); }
  }).get(async (_request, response) => {
    const owner = response.locals.feedbackOwner;
    try { response.json({ data: await options.repository.find(owner.sessionId, owner.userId) }); }
    catch { unavailable(response); }
  }).post(async (request, response) => {
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a rating or a listed reason." } }); return; }
    const owner = response.locals.feedbackOwner;
    try {
      await options.repository.save(owner.sessionId, owner.userId, owner.playPathId, parsed.data);
      response.json({ data: parsed.data });
    } catch { unavailable(response); }
  });
  return router;
}
