import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { ObjectId, type MongoClient } from "mongodb";
import { createAccountRouter, createMongoAccountRepository } from "../server/account.js";
import type { AuthRepository } from "../server/auth.js";

test("account deletion derives ownership, requires exact confirmation and clears the cookie only on success", async () => {
  const user = { id: "000000000000000000000001", email: "parent@example.test", emailVerified: false, hasChildProfile: false };
  let signedIn = true;
  let deleted = false;
  let failing = false;
  const calls: string[] = [];
  const auth = { async findUserBySession() { return signedIn && !deleted ? user : null; } } as unknown as AuthRepository;
  const app = express().use(express.json()).use(createAccountRouter({ auth, cookieSecure: true, repository: {
    async deleteOwnedAccount(id, email) { calls.push(id); assert.equal(email, user.email); if (failing) throw new Error("private storage detail"); deleted = true; return true; },
  } }));
  const send = (body: object) => request(app).delete("/account").set("Cookie", "play_spark_session=synthetic-test-session").send(body);
  signedIn = false;
  await send({ confirmationEmail: user.email }).expect(401);
  signedIn = true;
  for (const body of [{ confirmationEmail: "Parent@example.test" }, { confirmationEmail: ` ${user.email}` }, { confirmationEmail: "other@example.test" }, { confirmationEmail: user.email, userId: "someone-else" }, {}]) {
    await send(body).expect(400);
  }
  assert.equal(calls.length, 0);
  failing = true;
  const failure = await send({ confirmationEmail: user.email }).expect(503);
  assert.equal(failure.headers["set-cookie"], undefined);
  assert.ok(!JSON.stringify(failure.body).includes("private storage"));
  assert.equal(deleted, false);
  failing = false;
  const success = await send({ confirmationEmail: user.email }).expect(200);
  assert.deepEqual(success.body, { data: { deleted: true } });
  assert.match(String(success.headers["set-cookie"]), /play_spark_session=;.*HttpOnly; Secure; SameSite=Lax/);
  assert.deepEqual(calls, [user.id, user.id]);
  await send({ confirmationEmail: user.email }).expect(401);
});

test("Mongo account deletion removes only owned records and snapshots atomically, rolling back a failure", async () => {
  const owner = new ObjectId("000000000000000000000001");
  const other = new ObjectId("000000000000000000000002");
  const ownedSession = new ObjectId("000000000000000000000003");
  const otherSession = new ObjectId("000000000000000000000004");
  type Row = { _id?: ObjectId; userId?: ObjectId; playSessionId?: ObjectId; email?: string; status?: string };
  const rows = new Map<string, Row[]>([
    ["users", [{ _id: owner, email: "parent@example.test", status: "active" }, { _id: other, email: "other@example.test", status: "active" }]],
    ["playSessions", [{ _id: ownedSession, userId: owner }, { _id: otherSession, userId: other }]],
    ["sessionMissions", [{ playSessionId: ownedSession }, { playSessionId: otherSession }]],
    ["playPaths", [{ _id: ownedSession }]],
  ]);
  const ownedCollections = ["childProfiles", "favoritePlayPaths", "favoriteMissions", "feedback", "authSessions", "passwordResetTokens", "emailVerificationTokens"];
  for (const name of ownedCollections) rows.set(name, [{ userId: owner }, { userId: other }]);
  let failCollection: string | undefined = "feedback";
  let ended = 0;
  const matches = (row: Row, filter: Row) => Object.entries(filter).every(([key, value]) => String(row[key as keyof Row]) === String(value));
  const transaction = {
    async withTransaction(callback: () => Promise<boolean>) {
      const before = new Map([...rows].map(([key, value]) => [key, [...value]]));
      try { return await callback(); }
      catch (error) { rows.clear(); for (const [key, value] of before) rows.set(key, value); throw error; }
    },
    async endSession() { ended += 1; },
  };
  const client = {
    startSession() { return transaction; },
    db() { return { collection(name: string) { return {
      async deleteOne(filter: Row, options: { session: unknown }) {
        assert.equal(options.session, transaction);
        const index = (rows.get(name) ?? []).findIndex((row) => matches(row, filter));
        if (index < 0) return { deletedCount: 0 };
        rows.get(name)!.splice(index, 1); return { deletedCount: 1 };
      },
      find(filter: Row, options: { session: unknown }) {
        assert.equal(options.session, transaction);
        return { async *[Symbol.asyncIterator]() { for (const row of rows.get(name) ?? []) if (matches(row, filter)) yield row; } };
      },
      async deleteMany(filter: Row, options: { session: unknown }) {
        assert.equal(options.session, transaction);
        if (name === failCollection) throw new Error("simulated write failure");
        rows.set(name, (rows.get(name) ?? []).filter((row) => !matches(row, filter)));
      },
    }; } }; },
  } as unknown as MongoClient;
  const repository = createMongoAccountRepository({ async getClient() { return client; } }, "synthetic-test");
  await assert.rejects(repository.deleteOwnedAccount(owner.toHexString(), "parent@example.test"));
  assert.equal(rows.get("users")!.length, 2);
  assert.equal(rows.get("authSessions")!.length, 2);
  assert.equal(rows.get("sessionMissions")!.length, 2);
  failCollection = undefined;
  assert.equal(await repository.deleteOwnedAccount(owner.toHexString(), "wrong@example.test"), false);
  assert.equal(rows.get("users")!.length, 2);
  assert.equal(await repository.deleteOwnedAccount(owner.toHexString(), "parent@example.test"), true);
  for (const name of ["playSessions", ...ownedCollections]) {
    assert.equal(rows.get(name)!.length, 1);
    assert.equal(String(rows.get(name)![0]!.userId), other.toHexString());
  }
  assert.equal(String(rows.get("users")![0]!._id), other.toHexString());
  assert.equal(String(rows.get("sessionMissions")![0]!.playSessionId), otherSession.toHexString());
  assert.equal(rows.get("playPaths")!.length, 1);
  assert.equal(ended, 3);
});
