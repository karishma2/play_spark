import assert from "node:assert/strict";
import test from "node:test";
import request, { type Test } from "supertest";
import { createApp } from "../server/app.js";
import { hashSessionToken, type AuthRepository, type AuthUser } from "../server/auth.js";
import {
  ChildProfileAlreadyExistsError,
  type ChildProfile,
  type ChildProfileInput,
  type ChildProfileRepository,
  type ChildProfileUpdate,
  type ProfileOptions,
} from "../server/childProfile.js";
import type { CatalogRepository } from "../server/catalog.js";

const catalog: CatalogRepository = {
  async listGuestSamples() { return []; },
  async findGuestSample() { return null; },
  async findPublishedPlayPath() { return null; },
};

const profileOptions: ProfileOptions = {
  interests: [
    { key: "vehicles", label: "Vehicles" },
    { key: "animals", label: "Animals" },
  ],
  playStyles: [
    { key: "build", label: "Building" },
    { key: "pretend", label: "Pretend Play" },
  ],
};

function createMemoryState() {
  const users = new Map<string, AuthUser>();
  const sessionUsers = new Map<string, string>();
  const profiles = new Map<string, ChildProfile>();
  let nextProfile = 1;

  const auth: AuthRepository = {
    async findUserByEmail(email) { return [...users.values()].find((user) => user.email === email) ?? null; },
    async createUser() { throw new Error("Not needed by profile tests"); },
    async createSession() {},
    async findUserBySession(tokenHash) {
      const userId = sessionUsers.get(tokenHash);
      return userId ? users.get(userId) ?? null : null;
    },
    async deleteSession() {},
    async changePassword() {},
    async createPasswordResetToken() {},
    async consumePasswordResetToken() { return false; },
    async createEmailVerificationToken() {},
    async verifyEmailToken() { return false; },
  };

  const childProfiles: ChildProfileRepository = {
    async listOptions() { return profileOptions; },
    async findActiveByUserId(userId) { return profiles.get(userId) ?? null; },
    async create(userId, input: ChildProfileInput) {
      if (profiles.has(userId)) throw new ChildProfileAlreadyExistsError();
      const profile = { id: `profile-${nextProfile++}`, ...input };
      profiles.set(userId, profile);
      const user = users.get(userId);
      if (user) user.hasChildProfile = true;
      return profile;
    },
    async update(userId, input: ChildProfileUpdate) {
      const current = profiles.get(userId);
      if (!current) return null;
      const profile = { ...current, ...input };
      if (Object.hasOwn(input, "nickname") && !input.nickname) delete profile.nickname;
      profiles.set(userId, profile);
      return profile;
    },
  };

  function addUser(id: string, token: string, emailVerified = true) {
    users.set(id, {
      id,
      email: `${id}@example.com`,
      passwordHash: "test:password",
      hasChildProfile: false,
      emailVerified,
    });
    sessionUsers.set(hashSessionToken(token), id);
  }

  return { auth, childProfiles, profiles, addUser };
}

function createProfileApp(state: ReturnType<typeof createMemoryState>, requireEmailVerification = true) {
  return createApp({
    databaseName: "play_spark_test",
    catalog,
    auth: state.auth,
    childProfiles: state.childProfiles,
    requireEmailVerification,
    authCookieSecure: false,
  });
}

function signedIn(agent: Test, token: string) {
  return agent.set("Cookie", `play_spark_session=${token}`);
}

function validProfile(overrides: Partial<ChildProfileInput> = {}): ChildProfileInput {
  const now = new Date();
  return {
    nickname: "Sam",
    birthMonth: now.getUTCMonth() + 1,
    birthYear: now.getUTCFullYear() - 4,
    interestKeys: ["vehicles"],
    playStyleKeys: ["build"],
    ...overrides,
  };
}

test("requires a verified parent before returning profile options", async () => {
  const state = createMemoryState();
  state.addUser("unverified", "unverified-token", false);
  const app = createProfileApp(state);

  await request(app).get("/api/v1/profile-options").expect(401);
  const unverified = await signedIn(request(app).get("/api/v1/profile-options"), "unverified-token").expect(403);
  assert.equal(unverified.body.error.code, "EMAIL_VERIFICATION_REQUIRED");

  state.addUser("verified", "verified-token");
  const response = await signedIn(request(app).get("/api/v1/profile-options"), "verified-token").expect(200);
  assert.deepEqual(response.body.data, profileOptions);
});

test("allows an unverified parent through the child-profile gate during private beta", async () => {
  const state = createMemoryState();
  state.addUser("beta-parent", "beta-token", false);
  const app = createProfileApp(state, false);

  const response = await signedIn(request(app).get("/api/v1/profile-options"), "beta-token").expect(200);
  assert.deepEqual(response.body.data, profileOptions);
});

test("creates one owned child profile and updates restored session state", async () => {
  const state = createMemoryState();
  state.addUser("parent-one", "parent-one-token");
  state.addUser("parent-two", "parent-two-token");
  const app = createProfileApp(state);

  const created = await signedIn(request(app).post("/api/v1/child-profile"), "parent-one-token")
    .send(validProfile({ nickname: undefined }))
    .expect(201);
  assert.equal(created.body.data.nickname, undefined);

  const restored = await signedIn(request(app).get("/api/v1/auth/session"), "parent-one-token").expect(200);
  assert.equal(restored.body.data.hasChildProfile, true);

  const owned = await signedIn(request(app).get("/api/v1/child-profile"), "parent-one-token").expect(200);
  assert.equal(owned.body.data.id, created.body.data.id);
  await signedIn(request(app).get("/api/v1/child-profile"), "parent-two-token").expect(404);

  const duplicate = await signedIn(request(app).post("/api/v1/child-profile"), "parent-one-token")
    .send(validProfile({ nickname: "Another child" }))
    .expect(409);
  assert.equal(duplicate.body.error.code, "CONFLICT");
  assert.equal(state.profiles.size, 1);
});

test("rejects unsupported ages, option keys, and duplicate choices", async () => {
  const state = createMemoryState();
  state.addUser("parent", "parent-token");
  const app = createProfileApp(state);
  const now = new Date();

  const age = await signedIn(request(app).post("/api/v1/child-profile"), "parent-token")
    .send(validProfile({ birthYear: now.getUTCFullYear() - 2 }))
    .expect(400);
  assert.ok(age.body.error.fieldErrors.birthYear);

  const option = await signedIn(request(app).post("/api/v1/child-profile"), "parent-token")
    .send(validProfile({ interestKeys: ["unknown"] }))
    .expect(400);
  assert.ok(option.body.error.fieldErrors.interestKeys);

  const duplicate = await signedIn(request(app).post("/api/v1/child-profile"), "parent-token")
    .send(validProfile({ playStyleKeys: ["build", "build"] }))
    .expect(400);
  assert.ok(duplicate.body.error.fieldErrors.playStyleKeys);
  assert.equal(state.profiles.size, 0);
});

test("updates only the signed-in parent's profile and can remove the nickname", async () => {
  const state = createMemoryState();
  state.addUser("parent-one", "parent-one-token");
  state.addUser("parent-two", "parent-two-token");
  state.addUser("parent-without-profile", "parent-without-profile-token");
  const parentOne = await state.childProfiles.create("parent-one", validProfile());
  const parentTwo = await state.childProfiles.create("parent-two", validProfile({ nickname: "Jo" }));
  const app = createProfileApp(state);

  const updated = await signedIn(request(app).patch("/api/v1/child-profile"), "parent-one-token")
    .send({ nickname: "", interestKeys: ["animals"], playStyleKeys: ["pretend"] })
    .expect(200);

  assert.equal(updated.body.data.id, parentOne.id);
  assert.equal(updated.body.data.nickname, undefined);
  assert.deepEqual(updated.body.data.interestKeys, ["animals"]);
  assert.deepEqual(updated.body.data.playStyleKeys, ["pretend"]);
  assert.deepEqual(state.profiles.get("parent-two"), parentTwo);

  const notFound = await signedIn(request(app).patch("/api/v1/child-profile"), "parent-without-profile-token")
    .send(validProfile())
    .expect(404);
  assert.equal(notFound.body.error.code, "NOT_FOUND");

  const missing = await signedIn(request(app).patch("/api/v1/child-profile"), "missing-token")
    .send(validProfile())
    .expect(401);
  assert.equal(missing.body.error.code, "UNAUTHENTICATED");
});

test("returns safe errors when profile storage is unavailable", async () => {
  const state = createMemoryState();
  state.addUser("parent", "parent-token");
  const unavailable: ChildProfileRepository = {
    async listOptions() { throw new Error("private database detail"); },
    async findActiveByUserId() { throw new Error("private database detail"); },
    async create() { throw new Error("private database detail"); },
    async update() { throw new Error("private database detail"); },
  };
  const app = createApp({
    databaseName: "play_spark_test",
    catalog,
    auth: state.auth,
    childProfiles: unavailable,
    authCookieSecure: false,
  });

  const response = await signedIn(request(app).get("/api/v1/profile-options"), "parent-token").expect(503);
  assert.deepEqual(response.body, {
    error: { code: "PROFILE_UNAVAILABLE", message: "Profile setup is temporarily unavailable. Please try again." },
  });
});
