import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository } from "./auth.js";
import type { MongoClientProvider } from "./db.js";

export interface AccountRepository {
  deleteOwnedAccount(userId: string, confirmationEmail: string): Promise<boolean>;
}

export function createMongoAccountRepository(mongo: MongoClientProvider, databaseName: string): AccountRepository {
  return {
    async deleteOwnedAccount(userId, confirmationEmail) {
      const client = await mongo.getClient();
      const db = client.db(databaseName);
      const transaction = client.startSession();
      try {
        return await transaction.withTransaction(async () => {
          const owner = new ObjectId(userId);
          const removed = await db.collection("users").deleteOne(
            { _id: owner, email: confirmationEmail, status: "active" }, { session: transaction },
          );
          if (removed.deletedCount !== 1) return false;
          // Legacy mission snapshots reference the session rather than the parent.
          const sessions = db.collection("playSessions").find({ userId: owner }, { session: transaction, projection: { _id: 1 } });
          for await (const session of sessions) {
            await db.collection("sessionMissions").deleteMany({ playSessionId: session._id }, { session: transaction });
          }
          for (const name of ["childProfiles", "playSessions", "favoritePlayPaths", "favoriteMissions", "feedback", "authSessions", "passwordResetTokens", "emailVerificationTokens"]) {
            await db.collection(name).deleteMany({ userId: owner }, { session: transaction });
          }
          return true;
        }) ?? false;
      } finally {
        await transaction.endSession();
      }
    },
  };
}

const confirmationSchema = z.object({ confirmationEmail: z.string().email().max(254) }).strict();
export function createAccountRouter(options: { repository: AccountRepository; auth: AuthRepository; cookieSecure: boolean }) {
  const router = Router();
  router.delete("/account", async (request, response) => {
    const input = confirmationSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Type your account email exactly to confirm deletion." } }); return;
    }
    try {
      const user = await findAuthenticatedUser(request, options.auth);
      if (!user) {
        response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to manage your account." } }); return;
      }
      if (input.data.confirmationEmail !== user.email) {
        response.status(400).json({ error: { code: "CONFIRMATION_REQUIRED", message: "Type your account email exactly to confirm deletion." } }); return;
      }
      if (!await options.repository.deleteOwnedAccount(user.id, input.data.confirmationEmail)) {
        response.status(409).json({ error: { code: "ACCOUNT_UNAVAILABLE", message: "Your account changed. Please sign in again before retrying." } }); return;
      }
      response.clearCookie("play_spark_session", { httpOnly: true, secure: options.cookieSecure, sameSite: "lax", path: "/" });
      response.json({ data: { deleted: true } });
    } catch {
      response.status(503).json({ error: { code: "ACCOUNT_UNAVAILABLE", message: "We couldn't delete your account. Please try again." } });
    }
  });
  return router;
}
