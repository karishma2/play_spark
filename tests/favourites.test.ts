import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import express from "express";
import { createServer } from "node:http";
import { restoreVercelRequestUrl } from "../server/vercelRequest.js";
import { createFavouriteRouter, createMongoFavouriteRepository, type FavouriteRecord, type FavouriteRepository } from "../server/favourites.js";
import { MongoServerError, ObjectId, type MongoClient } from "mongodb";
import { hashSessionToken, type AuthRepository, type AuthUser } from "../server/auth.js";
import type { CatalogRepository, GuestSample } from "../server/catalog.js";

const pathId = "64b100000000000000000001";
const secondPathId = "64b100000000000000000002";
const parentId = "64b000000000000000000001";
const otherParentId = "64b000000000000000000002";
function fixture(requireEmailVerification = true) {
  const users = new Map<string, AuthUser>([
    [hashSessionToken("parent"), { id: parentId, email: "parent@example.com", passwordHash: "unused", hasChildProfile: true, emailVerified: true }],
    [hashSessionToken("other"), { id: otherParentId, email: "other@example.com", passwordHash: "unused", hasChildProfile: true, emailVerified: true }],
    [hashSessionToken("pending"), { id: parentId, email: "parent@example.com", passwordHash: "unused", hasChildProfile: false, emailVerified: false }],
  ]);
  const auth: AuthRepository = {
    async findUserBySession(hash) { return users.get(hash) ?? null; },
    async findUserByEmail() { return null; }, async createUser() { throw new Error("Not used"); },
    async createSession() {}, async deleteSession() {}, async changePassword() {},
    async createPasswordResetToken() {}, async consumePasswordResetToken() { return false; },
    async createEmailVerificationToken() {}, async verifyEmailToken() { return false; },
  };
  const records = new Map<string, FavouriteRecord & { userId: string }>();
  const repository: FavouriteRepository = {
    async list(userId, limit, before) {
      return [...records.values()].filter((row) => row.userId === userId && (!before || row.id < before))
        .sort((a, b) => b.id.localeCompare(a.id)).slice(0, limit).map(({ userId: _owner, ...row }) => row);
    },
    async has(userId, id) { return records.has(`${userId}:${id}`); },
    async save(userId, id) {
      if (!records.has(`${userId}:${id}`)) records.set(`${userId}:${id}`, { id, userId, playPathId: id, createdAt: "2026-10-08T00:00:00.000Z" });
    },
    async remove(userId, id) { records.delete(`${userId}:${id}`); },
  };
  const published = new Set([pathId, secondPathId]);
  const catalog = { async findPublishedPlayPath(id: string) {
    return published.has(id) ? { id, title: "Paper town", summary: "Draw and build a town.", durationMinutes: 20, imageUrl: "/town.svg", imageAlt: "Paper town", safetyNote: "Keep clear.", missions: [] } as unknown as GuestSample : null;
  } } as CatalogRepository;
  const app = express(); app.use(express.json());
  app.use("/api/v1", createFavouriteRouter({ repository, authRepository: auth, catalog, requireEmailVerification }));
  return { app, records, repository, published };
}
const cookie = (owner = "parent") => `play_spark_session=${owner}`;
const endpoint = (id = pathId) => `/api/v1/favourites/play-paths/${id}`;

test("favourites validate the public URL even when the runtime reinstalls rewrite query metadata", async () => {
  const state = fixture();
  const deployed = createServer((incoming, response) => {
    const url = new URL(incoming.url ?? "/", "https://play-spark.invalid");
    url.searchParams.set("__path", "v1/favourites");
    url.searchParams.set("path", "v1/favourites");
    incoming.url = `/api/index?${url.searchParams}`;
    Object.assign(incoming, { originalUrl: incoming.url });
    restoreVercelRequestUrl(incoming);
    Object.defineProperty(incoming, "query", { value: Object.fromEntries(url.searchParams), configurable: true });
    state.app(incoming, response);
  });
  const page = await request(deployed).get("/api/v1/favourites?limit=10").set("Cookie", cookie()).expect(200);
  assert.deepEqual(page.body.data, { playPaths: [], nextCursor: null });
  await request(deployed).get("/api/v1/favourites?limit=21").set("Cookie", cookie()).expect(400);
  await request(deployed).get("/api/v1/favourites?limit=10&userId=other").set("Cookie", cookie()).expect(400);
  await request(deployed).get("/api/v1/favourites?limit=10&limit=1").set("Cookie", cookie()).expect(400);
});

test("MongoDB concurrent-save recovery only accepts the exact owner's existing bookmark", async () => {
  const duplicate = new MongoServerError({ code: 11000, message: "Duplicate bookmark" });
  let exists = true;
  let indexCreated = false;
  const collection = {
    async createIndex(_keys: unknown, options: { unique: boolean }) { assert.equal(options.unique, true); indexCreated = true; return "owner_path"; },
    async updateOne(filter: { userId: ObjectId; playPathId: ObjectId }) {
      assert.equal(indexCreated, true);
      assert.equal(filter.userId.toHexString(), parentId); assert.equal(filter.playPathId.toHexString(), pathId);
      throw duplicate;
    },
    async findOne(filter: { userId: ObjectId; playPathId: ObjectId }) {
      assert.equal(filter.userId.toHexString(), parentId); assert.equal(filter.playPathId.toHexString(), pathId);
      return exists ? { _id: new ObjectId() } : null;
    },
  };
  const client = { db() { return { collection() { return collection; } }; } } as unknown as MongoClient;
  const repository = createMongoFavouriteRepository({ async getClient() { return client; } }, "synthetic");
  await repository.save(parentId, pathId);
  exists = false;
  await assert.rejects(repository.save(parentId, pathId), (error) => error === duplicate);
});

test("favourites save and remove are repeatable, parent-owned, and survive catalogue withdrawal", async () => {
  const state = fixture();
  await Promise.all([1, 2, 3].map(() => request(state.app).put(endpoint()).set("Cookie", cookie()).expect(200)));
  assert.equal(state.records.size, 1);
  const saved = await request(state.app).get(endpoint()).set("Cookie", cookie()).expect(200);
  assert.equal(saved.body.data.saved, true);
  await request(state.app).put(endpoint()).set("Cookie", cookie("other")).expect(200);
  const page = await request(state.app).get("/api/v1/favourites").set("Cookie", cookie()).expect(200);
  assert.equal(page.body.data.playPaths.length, 1);
  assert.equal(page.body.data.playPaths[0].activity.title, "Paper town");
  assert.equal(page.body.data.playPaths[0].userId, undefined);
  assert.equal(page.body.data.playPaths[0].activity.missions, undefined);
  state.published.delete(pathId);
  const retired = await request(state.app).get("/api/v1/favourites").set("Cookie", cookie()).expect(200);
  assert.equal(retired.body.data.playPaths[0].activity, null);
  await request(state.app).put(endpoint()).set("Cookie", cookie()).expect(404);
  await request(state.app).delete(endpoint()).set("Cookie", cookie()).expect(200);
  await request(state.app).delete(endpoint()).set("Cookie", cookie()).expect(200);
  assert.equal(await state.repository.has(otherParentId, pathId), true);
  assert.equal(await state.repository.has(parentId, pathId), false);
});

test("favourites paginate newest first and validate identifiers, fields, and bounded queries", async () => {
  const state = fixture();
  await state.repository.save(parentId, pathId); await state.repository.save(parentId, secondPathId);
  const page = await request(state.app).get("/api/v1/favourites?limit=1").set("Cookie", cookie()).expect(200);
  assert.equal(page.body.data.playPaths[0].playPathId, secondPathId);
  const next = await request(state.app).get(`/api/v1/favourites?limit=1&before=${page.body.data.nextCursor}`).set("Cookie", cookie()).expect(200);
  assert.equal(next.body.data.playPaths[0].playPathId, pathId); assert.equal(next.body.data.nextCursor, null);
  for (const query of ["limit=21", "limit=0", "before=invalid", "userId=other"]) {
    await request(state.app).get(`/api/v1/favourites?${query}`).set("Cookie", cookie()).expect(400);
  }
  for (const method of ["get", "put", "delete"] as const) {
    await request(state.app)[method](endpoint("invalid")).set("Cookie", cookie()).expect(400);
  }
  await request(state.app).put(endpoint()).set("Cookie", cookie()).send({ userId: otherParentId }).expect(400);
  const upper = await request(state.app).get(endpoint(pathId.toUpperCase())).set("Cookie", cookie()).expect(200);
  assert.equal(upper.body.data.saved, true);
});

test("favourites enforce authentication and verification policy, including beta access", async () => {
  for (const method of ["get", "put", "delete"] as const) {
    await request(fixture().app)[method](endpoint()).expect(401);
    await request(fixture().app)[method](endpoint()).set("Cookie", cookie("pending")).expect(403);
  }
  await request(fixture().app).get("/api/v1/favourites").expect(401);
  const state = fixture(false);
  await request(state.app).put(endpoint()).set("Cookie", cookie("pending")).expect(200);
  const other = await request(state.app).get(endpoint()).set("Cookie", cookie("other")).expect(200);
  assert.equal(other.body.data.saved, false);
});

test("favourites storage errors are safe and never return partial lists", async () => {
  const state = fixture();
  state.repository.list = async () => { throw new Error("private storage error"); };
  const failure = await request(state.app).get("/api/v1/favourites").set("Cookie", cookie()).expect(503);
  assert.equal(failure.body.error.code, "FAVOURITES_UNAVAILABLE");
  assert.ok(!JSON.stringify(failure.body).includes("private"));
});
