import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createServer } from "node:http";
import { restoreVercelRequestUrl } from "../server/vercelRequest.js";
import { createApp } from "../server/app.js";
import { hashSessionToken, type AuthRepository, type AuthUser } from "../server/auth.js";
import type { CatalogRepository, GuestSample } from "../server/catalog.js";
import type { ChildProfile, ChildProfileRepository } from "../server/childProfile.js";
import {
  ActivePlaySessionExistsError,
  type PlaySession,
  type PlaySessionRepository,
} from "../server/playSessions.js";

const userId = "64b000000000000000000001";
const profileId = "64b200000000000000000001";
const pathId = "64b100000000000000000001";
const otherPathId = "64b100000000000000000002";
const missionIds = ["64b300000000000000000001", "64b300000000000000000002"];
const replacementMissionIds = ["64b300000000000000000101", "64b300000000000000000102"];

function playPath(id = pathId): GuestSample {
  return {
    id,
    title: "Build a route",
    summary: "Build and improve a route.",
    goal: "Practise planning.",
    supports: ["Planning"],
    durationMinutes: 20,
    setupMinutes: 2,
    parentEffort: "Low",
    messLevel: "None",
    category: "Building",
    secondaryCategory: "Pretend play",
    imageUrl: "/route.svg",
    imageAlt: "A route",
    materials: ["blocks"],
    safetyNote: "Keep the floor clear.",
    wallSceneKey: "route",
    missions: missionIds.map((id, index) => ({
      id,
      title: `Mission ${index + 1}`,
      durationMinutes: 10,
      setupSteps: ["Set out blocks."],
      sayThis: "Build it.",
      childChallenge: "Make the route.",
      tidyUp: "Put blocks away.",
      wallElement: { key: `part-${index + 1}`, label: `Part ${index + 1}`, revealMessage: "Revealed!" },
      replacementMissionId: replacementMissionIds[index],
    })),
  };
}

function createMemoryState() {
  const users = new Map<string, AuthUser>();
  const sessionUsers = new Map<string, string>();
  const sessions = new Map<string, PlaySession & { userId: string }>();
  let nextSession = 1;

  const auth: AuthRepository = {
    async findUserByEmail() { return null; },
    async createUser() { throw new Error("Not used"); },
    async createSession() {},
    async findUserBySession(tokenHash) {
      const id = sessionUsers.get(tokenHash);
      return id ? users.get(id) ?? null : null;
    },
    async deleteSession() {},
    async changePassword() {},
    async createPasswordResetToken() {},
    async consumePasswordResetToken() { return false; },
    async createEmailVerificationToken() {},
    async verifyEmailToken() { return false; },
  };
  const childProfile: ChildProfile = {
    id: profileId,
    birthMonth: 6,
    birthYear: 2022,
    interestKeys: ["vehicles"],
    playStyleKeys: ["build"],
  };
  const childProfiles: ChildProfileRepository = {
    async listOptions() { return { interests: [], playStyles: [] }; },
    async findActiveByUserId(id) { return id === userId ? childProfile : null; },
    async create() { throw new Error("Not used"); },
    async update() { return null; },
  };
  const catalog: CatalogRepository = {
    async listGuestSamples() { return []; },
    async findGuestSample() { return null; },
    async findPublishedPlayPath(id) { return [pathId, otherPathId].includes(id) ? playPath(id) : null; },
    async findPublishedMission(id) {
      return { id, title: "A quieter mission", durationMinutes: 5, setupSteps: ["Use one soft object."], sayThis: "Try this instead.", childChallenge: "Make a quiet route.", tidyUp: "Put the object away." };
    },
  };
  const playSessions: PlaySessionRepository = {
    async listHistory(ownerId, childId, limit, before) {
      return [...sessions.values()]
        .filter((item) => item.userId === ownerId && item.childProfileId === childId && item.status !== "active")
        .filter((item) => !before || item.updatedAt < before.updatedAt || (item.updatedAt === before.updatedAt && item.id < before.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)).slice(0, limit);
    },
    async findActive(ownerId, childId) {
      return [...sessions.values()].find((item) => item.userId === ownerId && item.childProfileId === childId && item.status === "active") ?? null;
    },
    async findOwned(id, ownerId) {
      const session = sessions.get(id);
      return session?.userId === ownerId ? session : null;
    },
    async create(ownerId, childId, selectedPath) {
      if ([...sessions.values()].some((item) => item.childProfileId === childId && item.status === "active")) {
        throw new ActivePlaySessionExistsError();
      }
      const now = new Date().toISOString();
      const session = {
        id: `64b40000000000000000000${nextSession++}`,
        userId: ownerId,
        childProfileId: childId,
        status: "active" as const,
        playPath: selectedPath,
        completedMissionIds: [],
        missionReplacements: [],
        startedAt: now,
        updatedAt: now,
      };
      sessions.set(session.id, session);
      return session;
    },
    async recordMissionCompletion(id, ownerId, previous, missionId, completes) {
      const current = sessions.get(id);
      if (!current || current.userId !== ownerId || current.status !== "active") return null;
      if (current.completedMissionIds.join() !== previous.join()) return null;
      const updated = {
        ...current,
        status: completes ? "completed" as const : "active" as const,
        completedMissionIds: [...previous, missionId],
        updatedAt: new Date().toISOString(),
        ...(completes ? { completedAt: new Date().toISOString() } : {}),
      };
      sessions.set(id, updated);
      return updated;
    },
    async recordMissionReplacement(id, ownerId, childId, previous, originalMissionId, replacementMission, reason) {
      const current = sessions.get(id);
      if (!current || current.userId !== ownerId || current.childProfileId !== childId || current.status !== "active") return null;
      if (current.completedMissionIds.join() !== previous.join()) return null;
      if (current.missionReplacements.some((item) => item.originalMissionId === originalMissionId)) return null;
      const updated = {
        ...current,
        missionReplacements: [...current.missionReplacements, { originalMissionId, replacementMission, reason, replacedAt: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, updated);
      return updated;
    },
    async abandon(id, ownerId, childId) {
      const current = sessions.get(id);
      if (!current || current.userId !== ownerId || current.childProfileId !== childId || current.status !== "active") return null;
      const updated = { ...current, status: "abandoned" as const, abandonedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      sessions.set(id, updated);
      return updated;
    },
  };

  users.set(userId, { id: userId, email: "parent@example.com", passwordHash: "unused", hasChildProfile: true, emailVerified: true });
  sessionUsers.set(hashSessionToken("parent-token"), userId);
  return { auth, childProfiles, catalog, playSessions, sessions };
}

test("Vercel rewrite query does not leak into strict history pagination validation", async () => {
  const application = app();
  const deployed = createServer((incoming, response) => {
    const publicUrl = new URL(incoming.url ?? "/", "https://play-spark.invalid");
    publicUrl.searchParams.set("__path", "v1/play-sessions/history");
    publicUrl.searchParams.set("path", "v1/play-sessions/history");
    // Cover both forwarded-function URLs and Vercel's preserved public URL.
    incoming.url = publicUrl.searchParams.get("limit") === "1"
      ? `/api/v1/play-sessions/history?${publicUrl.searchParams}`
      : `/api/index?${publicUrl.searchParams}`;
    Object.assign(incoming, { originalUrl: incoming.url });
    Object.defineProperty(incoming, "query", { value: Object.fromEntries(publicUrl.searchParams), configurable: true });
    restoreVercelRequestUrl(incoming);
    // A runtime query accessor may be installed again after adapter normalization.
    Object.defineProperty(incoming, "query", { value: Object.fromEntries(publicUrl.searchParams), configurable: true });
    application(incoming, response);
  });
  const page = await request(deployed).get("/api/v1/play-sessions/history?limit=10")
    .set("Cookie", "play_spark_session=parent-token").expect(200);
  assert.deepEqual(page.body.data, { sessions: [], nextCursor: null });
  await request(deployed).get("/api/v1/play-sessions/history?limit=1")
    .set("Cookie", "play_spark_session=parent-token").expect(200);
  await request(deployed).get("/api/v1/play-sessions/history?limit=21")
    .set("Cookie", "play_spark_session=parent-token").expect(400);
  await request(deployed).get("/api/v1/play-sessions/history?limit=10&userId=other")
    .set("Cookie", "play_spark_session=parent-token").expect(400);
});

test("history is bounded, ordered, profile-owned and excludes active sessions", async () => {
  const state = createMemoryState();
  const saved = (id: string, overrides: Partial<PlaySession & { userId: string }> = {}) => ({
    id, userId, childProfileId: profileId, status: "completed" as const, playPath: playPath(),
    completedMissionIds: missionIds, missionReplacements: [], startedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z", completedAt: "2026-10-02T00:00:00.000Z", ...overrides,
  });
  const ids = [1, 2, 3, 4, 5].map((value) => `64b40000000000000000000${value}`);
  state.sessions.set(ids[0], saved(ids[0]));
  state.sessions.set(ids[1], saved(ids[1], { status: "abandoned" }));
  state.sessions.set(ids[2], saved(ids[2], { status: "active" }));
  state.sessions.set(ids[3], saved(ids[3], { childProfileId: "64b200000000000000000002" }));
  state.sessions.set(ids[4], saved(ids[4], { userId: "64b000000000000000000002" }));
  const application = app(state);
  const first = await request(application).get("/api/v1/play-sessions/history?limit=1").set("Cookie", "play_spark_session=parent-token").expect(200);
  assert.deepEqual(first.body.data.sessions.map((item: PlaySession) => item.id), [ids[1]]);
  const cursor = first.body.data.nextCursor;
  const second = await request(application).get(`/api/v1/play-sessions/history?limit=1&before=${cursor.updatedAt}&beforeId=${cursor.id}`).set("Cookie", "play_spark_session=parent-token").expect(200);
  assert.equal(second.body.data.sessions[0].id, ids[0]);
  assert.equal(second.body.data.nextCursor, null);
  for (const id of ids.slice(2)) await request(application).get(`/api/v1/play-sessions/history/${id}`).set("Cookie", "play_spark_session=parent-token").expect(404);
  await request(application).get("/api/v1/play-sessions/history").expect(401);
  for (const query of ["limit=21", "limit=0", "beforeId=invalid", "before=2026-10-02T00:00:00.000Z", "userId=other"]) {
    await request(application).get(`/api/v1/play-sessions/history?${query}`).set("Cookie", "play_spark_session=parent-token").expect(400);
  }
});

test("saved history preserves replacements and walls when replay uses changed catalogue content", async () => {
  const state = createMemoryState();
  const saved = await state.playSessions.create(userId, profileId, playPath());
  await state.playSessions.recordMissionReplacement(saved.id, userId, profileId, [], missionIds[0], {
    ...saved.playPath.missions[0], id: replacementMissionIds[0], title: "Saved substitute",
  }, "missing_materials");
  await state.playSessions.recordMissionCompletion(saved.id, userId, [], missionIds[0], false);
  await state.playSessions.recordMissionCompletion(saved.id, userId, [missionIds[0]], missionIds[1], true);
  state.catalog.findPublishedPlayPath = async () => ({ ...playPath(), title: "Updated catalogue title" });
  const application = app(state);
  const history = await request(application).get(`/api/v1/play-sessions/history/${saved.id}`).set("Cookie", "play_spark_session=parent-token").expect(200);
  assert.equal(history.body.data.playPath.title, "Build a route");
  assert.equal(history.body.data.missionReplacements[0].replacementMission.title, "Saved substitute");
  assert.deepEqual(history.body.data.completedMissionIds, missionIds);
  const replay = await request(application).post("/api/v1/play-sessions").set("Cookie", "play_spark_session=parent-token").send({ playPathId: pathId }).expect(201);
  assert.notEqual(replay.body.data.id, saved.id);
  assert.equal(replay.body.data.playPath.title, "Updated catalogue title");
  assert.deepEqual(replay.body.data.completedMissionIds, []);
  assert.deepEqual(state.sessions.get(saved.id)?.completedMissionIds, missionIds);
  state.catalog.findPublishedPlayPath = async () => null;
  await state.playSessions.abandon(replay.body.data.id, userId, profileId);
  await request(application).post("/api/v1/play-sessions").set("Cookie", "play_spark_session=parent-token").send({ playPathId: pathId }).expect(404);
  await request(application).get(`/api/v1/play-sessions/history/${saved.id}`).set("Cookie", "play_spark_session=parent-token").expect(200);
});

function app(state = createMemoryState()) {
  return createApp({ databaseName: "test", ...state });
}

test("replay rejects a historic path outside the child's current catalogue age band", async () => {
  const state = createMemoryState();
  const historic = await state.playSessions.create(userId, profileId, playPath());
  await state.playSessions.recordMissionCompletion(historic.id, userId, [], missionIds[0], false);
  await state.playSessions.recordMissionCompletion(historic.id, userId, [missionIds[0]], missionIds[1], true);
  const now = new Date();
  const profile = await state.childProfiles.findActiveByUserId(userId);
  assert.ok(profile);
  profile.birthYear = now.getUTCFullYear() - 5;
  profile.birthMonth = now.getUTCMonth() + 1;
  state.catalog.findPublishedPlayPath = async (id, band) => {
    assert.equal(band, "5_6");
    return ["3_4"].includes(band ?? "") ? playPath(id) : null;
  };
  const application = app(state);
  const replay = await request(application).post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token").send({ playPathId: pathId }).expect(404);
  assert.equal(replay.body.error.code, "NOT_FOUND");
  assert.equal(state.sessions.size, 1);
  assert.equal(await state.playSessions.findActive(userId, profileId), null);
  const saved = await request(application).get(`/api/v1/play-sessions/history/${historic.id}`)
    .set("Cookie", "play_spark_session=parent-token").expect(200);
  assert.deepEqual(saved.body.data.completedMissionIds, missionIds);
  state.catalog.findPublishedPlayPath = async (id, band) => band === "5_6" ? playPath(id) : null;
  await request(application).post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token").send({ playPathId: pathId }).expect(201);
});

test("starts and resumes one parent-owned active Play Path", async () => {
  const application = app();
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId })
    .expect(201);

  assert.equal(started.body.data.playPath.id, pathId);
  assert.deepEqual(started.body.data.completedMissionIds, []);

  const active = await request(application)
    .get("/api/v1/play-sessions/active")
    .set("Cookie", "play_spark_session=parent-token")
    .expect(200);
  assert.equal(active.body.data.id, started.body.data.id);

  const resumed = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId })
    .expect(200);
  assert.equal(resumed.body.data.id, started.body.data.id);
});

test("completes missions in order and treats a repeated completion as safe", async () => {
  const application = app();
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId });
  const id = started.body.data.id as string;

  await request(application)
    .post(`/api/v1/play-sessions/${id}/missions/${missionIds[1]}/complete`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(409);

  const first = await request(application)
    .post(`/api/v1/play-sessions/${id}/missions/${missionIds[0]}/complete`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(200);
  assert.deepEqual(first.body.data.completedMissionIds, [missionIds[0]]);

  const retry = await request(application)
    .post(`/api/v1/play-sessions/${id}/missions/${missionIds[0]}/complete`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(200);
  assert.deepEqual(retry.body.data.completedMissionIds, [missionIds[0]]);

  const final = await request(application)
    .post(`/api/v1/play-sessions/${id}/missions/${missionIds[1]}/complete`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(200);
  assert.equal(final.body.data.status, "completed");
  assert.deepEqual(final.body.data.completedMissionIds, missionIds);
});

test("records one curated mission replacement and completes the original mission position", async () => {
  const application = app();
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId })
    .expect(201);
  const sessionId = started.body.data.id as string;

  const swapped = await request(application)
    .post(`/api/v1/play-sessions/${sessionId}/missions/${missionIds[0]}/skip`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({ reason: "missing_materials" })
    .expect(200);

  assert.equal(swapped.body.data.missionReplacements.length, 1);
  assert.equal(swapped.body.data.missionReplacements[0].originalMissionId, missionIds[0]);
  assert.equal(swapped.body.data.missionReplacements[0].replacementMission.id, replacementMissionIds[0]);
  assert.equal(swapped.body.data.missionReplacements[0].replacementMission.wallElement.key, "part-1");

  const repeated = await request(application)
    .post(`/api/v1/play-sessions/${sessionId}/missions/${missionIds[0]}/skip`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({ reason: "child_not_interested" })
    .expect(200);
  assert.equal(repeated.body.data.missionReplacements.length, 1);
  assert.equal(repeated.body.data.missionReplacements[0].reason, "missing_materials");

  const completed = await request(application)
    .post(`/api/v1/play-sessions/${sessionId}/missions/${missionIds[0]}/complete`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(200);
  assert.deepEqual(completed.body.data.completedMissionIds, [missionIds[0]]);
});

test("rejects invalid skip reasons without changing the active mission", async () => {
  const application = app();
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId });

  const response = await request(application)
    .post(`/api/v1/play-sessions/${started.body.data.id}/missions/${missionIds[0]}/skip`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({ reason: "surprise_me" })
    .expect(400);

  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("blocks another Play Path until the active session is ended", async () => {
  const application = app();
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId });

  const conflict = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: otherPathId })
    .expect(409);
  assert.equal(conflict.body.error.code, "ACTIVE_SESSION_EXISTS");

  await request(application)
    .post(`/api/v1/play-sessions/${started.body.data.id}/abandon`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(200);

  const replacement = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: otherPathId })
    .expect(201);
  assert.equal(replacement.body.data.playPath.id, otherPathId);
});

test("resumes the same Play Path when concurrent creation wins the active-session race", async () => {
  const state = createMemoryState();
  const repository = state.playSessions;
  state.playSessions = {
    ...repository,
    async create(ownerId, childId, selectedPath) {
      await repository.create(ownerId, childId, selectedPath);
      throw new ActivePlaySessionExistsError();
    },
  };

  const response = await request(app(state))
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId })
    .expect(200);

  assert.equal(response.body.data.playPath.id, pathId);
  assert.equal(response.body.data.status, "active");
});

test("does not abandon a session owned by a different active child profile", async () => {
  const state = createMemoryState();
  const application = app(state);
  const started = await request(application)
    .post("/api/v1/play-sessions")
    .set("Cookie", "play_spark_session=parent-token")
    .send({ playPathId: pathId });

  state.childProfiles.findActiveByUserId = async () => ({
    id: "64b200000000000000000099",
    birthMonth: 6,
    birthYear: 2022,
    interestKeys: ["vehicles"],
    playStyleKeys: ["build"],
  });

  await request(application)
    .post(`/api/v1/play-sessions/${started.body.data.id}/abandon`)
    .set("Cookie", "play_spark_session=parent-token")
    .send({})
    .expect(404);
});

test("requires an authenticated parent with a child profile", async () => {
  await request(app()).get("/api/v1/play-sessions/active").expect(401);
});
