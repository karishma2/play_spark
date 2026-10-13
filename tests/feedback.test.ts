import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { MongoServerError, type MongoClient } from "mongodb";
import { createFeedbackRouter, createMongoFeedbackRepository, type FeedbackRepository, type PlayFeedback } from "../server/feedback.js";
import { hashSessionToken, type AuthRepository, type AuthUser } from "../server/auth.js";
import type { ChildProfileRepository } from "../server/childProfile.js";
import type { PlaySessionRepository, PlaySessionStatus } from "../server/playSessions.js";

const parentId = "64b000000000000000000001";
const sessionId = "64b400000000000000000001";
const profileId = "64b200000000000000000001";
const pathId = "64b100000000000000000001";
const endpoint = `/api/v1/play-sessions/${sessionId}/feedback`;
const cookie = "play_spark_session=synthetic-parent";
function fixture(requireEmailVerification = false) {
  let status: PlaySessionStatus = "completed";
  let activeProfile = profileId;
  let owned = true;
  let verified = false;
  const user: AuthUser = { id: parentId, email: "parent@example.com", passwordHash: "unused", hasChildProfile: true, emailVerified: verified };
  const auth = { async findUserBySession(hash: string) {
    return hash === hashSessionToken("synthetic-parent") ? { ...user, emailVerified: verified } : null;
  } } as unknown as AuthRepository;
  const profiles = { async findActiveByUserId() { return { id: activeProfile }; } } as unknown as ChildProfileRepository;
  const sessions = { async findOwned(id: string, owner: string) {
    assert.equal(owner, parentId);
    return owned && id === sessionId ? { id, childProfileId: profileId, status, playPath: { id: pathId } } : null;
  } } as PlaySessionRepository;
  const rows = new Map<string, PlayFeedback>();
  const repository: FeedbackRepository = {
    async find(id, owner) { assert.equal(owner, parentId); return rows.get(id) ?? null; },
    async save(id, owner, path, feedback) { assert.equal(owner, parentId); assert.equal(path, pathId); rows.set(id, feedback); },
  };
  const app = express(); app.use(express.json());
  app.use("/api/v1", createFeedbackRouter({ repository, auth, profiles, sessions, requireEmailVerification }));
  return { app, rows, repository, setStatus(value: PlaySessionStatus) { status = value; },
    setProfile(value: string) { activeProfile = value; }, setOwned(value: boolean) { owned = value; }, setVerified() { verified = true; } };
}

test("completed-session feedback is optional, persisted and revised in one record", async () => {
  const state = fixture();
  const empty = await request(state.app).get(endpoint).set("Cookie", cookie).expect(200);
  assert.equal(empty.body.data, null);
  const first = { overallRating: "loved_it", reasonKeys: [] };
  await request(state.app).post(endpoint).set("Cookie", cookie).send(first).expect(200);
  await request(state.app).post(endpoint).set("Cookie", cookie).send(first).expect(200);
  const revised = { overallRating: null, reasonKeys: ["not_suitable", "lost_interest"] };
  await request(state.app).post(endpoint).set("Cookie", cookie).send(revised).expect(200);
  const saved = await request(state.app).get(endpoint).set("Cookie", cookie).expect(200);
  assert.deepEqual(saved.body, { data: revised }); assert.equal(state.rows.size, 1);
});

test("feedback requires a completed session owned by the parent and active child", async () => {
  const state = fixture();
  for (const method of ["get", "post"] as const) {
    await request(state.app)[method](endpoint).expect(401);
    state.setOwned(false);
    await request(state.app)[method](endpoint).set("Cookie", cookie).expect(404);
    state.setOwned(true); state.setProfile("64b200000000000000000002");
    await request(state.app)[method](endpoint).set("Cookie", cookie).expect(404);
    state.setProfile(profileId);
    for (const status of ["active", "abandoned"] as const) {
      state.setStatus(status);
      await request(state.app)[method](endpoint).set("Cookie", cookie).expect(404);
    }
    state.setStatus("completed");
    await request(state.app)[method]('/api/v1/play-sessions/invalid/feedback').set("Cookie", cookie).expect(404);
  }
  assert.equal(state.rows.size, 0);
  const gated = fixture(true);
  await request(gated.app).post(endpoint).set("Cookie", cookie).send({ overallRating: "okay", reasonKeys: [] }).expect(403);
  gated.setVerified();
  await request(gated.app).post(endpoint).set("Cookie", cookie).send({ overallRating: "okay", reasonKeys: [] }).expect(200);
});

test("feedback rejects free text, injected ownership, empty responses and invalid reasons", async () => {
  const state = fixture();
  for (const input of [
    { overallRating: null, reasonKeys: [] }, { overallRating: "bad", reasonKeys: [] },
    { overallRating: "okay", reasonKeys: ["unknown"] }, { overallRating: "okay", reasonKeys: ["too_easy", "too_easy"] },
    { overallRating: "okay", reasonKeys: [], text: "free text" }, { overallRating: "okay", reasonKeys: [], userId: "other" },
  ]) await request(state.app).post(endpoint).set("Cookie", cookie).send(input).expect(400);
  assert.equal(state.rows.size, 0);
  state.repository.save = async () => { throw new Error("private database detail"); };
  const failure = await request(state.app).post(endpoint).set("Cookie", cookie).send({ overallRating: "okay", reasonKeys: [] }).expect(503);
  assert.equal(failure.body.error.code, "FEEDBACK_UNAVAILABLE");
  assert.ok(!JSON.stringify(failure.body).includes("private"));
});

test("Mongo feedback upserts preserve creation time and safely retry a first-write race", async () => {
  let calls = 0;
  let matchedCount = 1;
  const duplicate = new MongoServerError({ code: 11000, message: "Synthetic duplicate" });
  const collection = {
    async createIndex(keys: unknown, options: unknown) { assert.deepEqual(keys, { playSessionId: 1 }); assert.deepEqual(options, { unique: true }); },
    async updateOne(filter: unknown, update: unknown, options?: unknown) {
      const fields = update as { $set: PlayFeedback; $setOnInsert?: { createdAt: Date } };
      assert.equal(fields.$set.overallRating, "okay");
      assert.equal((filter as { userId: { toHexString(): string } }).userId.toHexString(), parentId);
      if (options) { assert.ok(fields.$setOnInsert?.createdAt instanceof Date); calls += 1; throw duplicate; }
      assert.equal(fields.$setOnInsert, undefined); return { matchedCount };
    },
  };
  const client = { db() { return { collection() { return collection; } }; } } as unknown as MongoClient;
  const repository = createMongoFeedbackRepository({ async getClient() { return client; } }, "synthetic");
  await repository.save(sessionId, parentId, pathId, { overallRating: "okay", reasonKeys: [] });
  matchedCount = 0;
  await assert.rejects(repository.save(sessionId, parentId, pathId, { overallRating: "okay", reasonKeys: [] }), (error) => error === duplicate);
  assert.equal(calls, 2);
});
