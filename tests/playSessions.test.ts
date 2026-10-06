import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
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
  };
  const playSessions: PlaySessionRepository = {
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
  return { auth, childProfiles, catalog, playSessions };
}

function app(state = createMemoryState()) {
  return createApp({ databaseName: "test", ...state });
}

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
