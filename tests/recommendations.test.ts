import assert from "node:assert/strict";
import test from "node:test";
import request, { type Test } from "supertest";
import { createApp } from "../server/app.js";
import { hashSessionToken, type AuthRepository, type AuthUser } from "../server/auth.js";
import type { ChildProfile, ChildProfileRepository } from "../server/childProfile.js";
import type { CatalogRepository } from "../server/catalog.js";
import {
  rankRecommendations,
  type RecommendationCandidate,
  type RecommendationRepository,
} from "../server/recommendations.js";

const catalog: CatalogRepository = {
  async listGuestSamples() { return []; },
  async findGuestSample() { return null; },
  async findPublishedPlayPath() { return null; },
};

const profile: ChildProfile = {
  id: "profile-one",
  nickname: "Sam",
  birthMonth: 6,
  birthYear: 2022,
  interestKeys: ["vehicles"],
  playStyleKeys: ["build"],
};

function candidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id: "64b100000000000000000001",
    title: "Build a route",
    summary: "Build and improve a toy route.",
    goal: "Practise planning.",
    supports: ["Planning", "Spatial language"],
    durationMinutes: 20,
    themeKey: "vehicles",
    eligibility: {
      ageBands: ["3_4", "4_5", "5_6"],
      interestKeys: ["vehicles"],
      playStyleKeys: ["build"],
      energyLevels: ["ready_to_play"],
      noiseLevel: "quiet",
      messLevel: "none",
      spaceLevel: "small",
      independenceLevel: "check_in_occasionally",
    },
    preview: {
      setupMinutes: 2,
      imageUrl: "/route.svg",
      imageAlt: "A toy route",
      materials: ["blocks", "toy car"],
    },
    ...overrides,
  };
}

const selection = {
  availableMinutes: 20 as const,
  currentState: "ready_to_play" as const,
  constraints: ["small_space", "quiet", "mostly_independent"] as const,
  themeKey: "vehicles",
};

test("prefers unplayed paths within a match group while retaining repeats and exact priority", () => {
  const repeat = candidate();
  const fresh = candidate({ id: "64b100000000000000000002", durationMinutes: 15 });
  const fallback = candidate({ id: "64b100000000000000000003", themeKey: "animals" });
  const choices = { ...selection, constraints: [] };
  const result = rankRecommendations([repeat, fresh, fallback], profile, choices, new Date("2026-10-01"), new Set([repeat.id]));
  assert.deepEqual(result.map(({ playPathId }) => playPathId), [fresh.id, repeat.id, fallback.id]);
  assert.deepEqual(result.map(({ playedBefore }) => playedBefore), [false, true, false]);
  const allPlayed = rankRecommendations([repeat, fresh], profile, choices, new Date("2026-10-01"), new Set([repeat.id, fresh.id]));
  assert.equal(allPlayed.length, 2);
  assert.ok(allPlayed.every(({ playedBefore }) => playedBefore));
});

test("recommendations use server-owned completion history and hide lookup failures", async () => {
  const state = createState();
  state.recommendations.findCompletedPlayPathIds = async (ownerId, childId, candidates) => {
    assert.equal(ownerId, "parent-one");
    assert.equal(childId, profile.id);
    assert.deepEqual(candidates, [candidate().id]);
    return [candidate().id];
  };
  const application = recommendationApp(state);
  const result = await signedIn(request(application).post("/api/v1/recommendations")).send(selection).expect(200);
  assert.equal(result.body.data.recommendations[0].playedBefore, true);
  state.recommendations.findCompletedPlayPathIds = async () => { throw new Error("private storage detail"); };
  const failure = await signedIn(request(application).post("/api/v1/recommendations")).send(selection).expect(503);
  assert.ok(!JSON.stringify(failure.body).includes("private storage detail"));
});

test("ranks exact personalized matches first with deterministic ties", () => {
  const differentStyle = candidate({
    id: "64b100000000000000000002",
    title: "Animal story",
    themeKey: "animals",
    eligibility: {
      ...candidate().eligibility,
      interestKeys: ["animals"],
      playStyleKeys: ["pretend"],
    },
  });
  const exactLaterId = candidate({ id: "64b100000000000000000003", title: "Another route" });

  const result = rankRecommendations(
    [differentStyle, exactLaterId, candidate()],
    profile,
    { ...selection, constraints: [...selection.constraints] },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.deepEqual(result.map(({ playPathId }) => playPathId), [
    "64b100000000000000000001",
    "64b100000000000000000003",
    "64b100000000000000000002",
  ]);
  assert.equal(result[0]?.matchType, "exact");
  assert.equal(result[2]?.matchType, "best_available");
  assert.match(result[2]?.explanation ?? "", /preferred interests/u);
});

test("ranks an exact shorter activity ahead of a duration-closer fallback", () => {
  const exactFifteen = candidate({
    id: "64b100000000000000000061",
    durationMinutes: 15,
  });
  const fallbackTwenty = candidate({
    id: "64b100000000000000000062",
    durationMinutes: 20,
    eligibility: { ...candidate().eligibility, energyLevels: ["calm"] },
  });

  const result = rankRecommendations(
    [fallbackTwenty, exactFifteen],
    profile,
    { ...selection, constraints: [...selection.constraints] },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.equal(result[0]?.playPathId, exactFifteen.id);
  assert.equal(result[0]?.matchType, "exact");
  assert.equal(result[1]?.matchType, "best_available");
});

test("identifies each relaxed practical constraint in fallback explanations", () => {
  const constrained = candidate({
    eligibility: {
      ...candidate().eligibility,
      noiseLevel: "moderate",
      spaceLevel: "medium",
      independenceLevel: "parent_guided",
    },
  });

  const [result] = rankRecommendations(
    [constrained],
    profile,
    { ...selection, constraints: ["small_space", "quiet", "mostly_independent"] },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.equal(result?.matchType, "best_available");
  assert.match(result?.explanation ?? "", /small-space requirement/u);
  assert.match(result?.explanation ?? "", /quiet setting/u);
  assert.match(result?.explanation ?? "", /mostly independent play/u);
});

test("keeps age eligibility mandatory and returns at most three results", () => {
  const tooOld = candidate({
    id: "64b100000000000000000010",
    eligibility: { ...candidate().eligibility, ageBands: ["6_7"] },
  });
  const suitable = [1, 2, 3, 4].map((number) => candidate({
    id: `64b10000000000000000000${number}`,
    title: `Suitable ${number}`,
  }));

  const result = rankRecommendations(
    [tooOld, ...suitable],
    profile,
    { ...selection, constraints: [...selection.constraints] },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.equal(result.length, 3);
  assert.ok(result.every(({ playPathId }) => playPathId !== tooOld.id));
});

test("changes the leading recommendation when the selected duration changes", () => {
  const tenMinute = candidate({ id: "64b100000000000000000041", title: "Ten minute activity", durationMinutes: 10 });
  const thirtyMinute = candidate({ id: "64b100000000000000000042", title: "Thirty minute activity", durationMinutes: 30 });
  const now = new Date("2026-10-01T00:00:00Z");

  const shortResult = rankRecommendations(
    [thirtyMinute, tenMinute],
    profile,
    { ...selection, availableMinutes: 10, constraints: [] },
    now,
  );
  const longResult = rankRecommendations(
    [tenMinute, thirtyMinute],
    profile,
    { ...selection, availableMinutes: 30, constraints: [] },
    now,
  );

  assert.equal(shortResult[0]?.playPathId, tenMinute.id);
  assert.equal(longResult[0]?.playPathId, thirtyMinute.id);
});

test("does not recommend activities longer than the available time when shorter options exist", () => {
  const tenMinute = candidate({ id: "64b100000000000000000051", durationMinutes: 10 });
  const twentyMinute = candidate({ id: "64b100000000000000000052", durationMinutes: 20 });

  const result = rankRecommendations(
    [twentyMinute, tenMinute],
    profile,
    { ...selection, availableMinutes: 10, constraints: [] },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.deepEqual(result.map(({ durationMinutes }) => durationMinutes), [10]);
});

function createState(options: { profile?: ChildProfile | null; emailVerified?: boolean } = {}) {
  const user: AuthUser = {
    id: "parent-one",
    email: "parent@example.com",
    passwordHash: "test:password",
    hasChildProfile: options.profile !== null,
    emailVerified: options.emailVerified ?? true,
  };
  const auth: AuthRepository = {
    async findUserByEmail() { return user; },
    async createUser() { throw new Error("Not needed"); },
    async createSession() {},
    async findUserBySession(tokenHash) {
      return tokenHash === hashSessionToken("parent-token") ? user : null;
    },
    async deleteSession() {},
    async changePassword() {},
    async createPasswordResetToken() {},
    async consumePasswordResetToken() { return false; },
    async createEmailVerificationToken() {},
    async verifyEmailToken() { return false; },
  };
  const childProfiles: ChildProfileRepository = {
    async listOptions() { return { interests: [], playStyles: [] }; },
    async findActiveByUserId() { return options.profile === null ? null : options.profile ?? profile; },
    async create() { throw new Error("Not needed"); },
    async update() { throw new Error("Not needed"); },
  };
  const recommendations: RecommendationRepository = {
    async listPublished() { return [candidate()]; },
    async findCompletedPlayPathIds() { return []; },
  };
  return { auth, childProfiles, recommendations };
}

function signedIn(testRequest: Test) {
  return testRequest.set("Cookie", "play_spark_session=parent-token");
}

function recommendationApp(
  state: ReturnType<typeof createState>,
  requireEmailVerification = true,
) {
  return createApp({
    databaseName: "play_spark_test",
    catalog,
    auth: state.auth,
    childProfiles: state.childProfiles,
    recommendations: state.recommendations,
    requireEmailVerification,
    authCookieSecure: false,
  });
}

test("returns personalized recommendations only for an eligible parent with a profile", async () => {
  const app = recommendationApp(createState());
  await request(app).post("/api/v1/recommendations").send(selection).expect(401);

  const response = await signedIn(request(app).post("/api/v1/recommendations"))
    .send(selection)
    .expect(200);
  assert.equal(response.body.data.recommendations[0].title, "Build a route");
  assert.equal(response.body.data.recommendations[0].matchType, "exact");
});

test("enforces profile and verification policy boundaries", async () => {
  const missingProfile = recommendationApp(createState({ profile: null }));
  const missing = await signedIn(request(missingProfile).post("/api/v1/recommendations"))
    .send(selection)
    .expect(409);
  assert.equal(missing.body.error.code, "CHILD_PROFILE_REQUIRED");

  const unverifiedState = createState({ emailVerified: false });
  const production = recommendationApp(unverifiedState);
  await signedIn(request(production).post("/api/v1/recommendations")).send(selection).expect(403);

  const beta = recommendationApp(unverifiedState, false);
  await signedIn(request(beta).post("/api/v1/recommendations")).send(selection).expect(200);
});

test("validates recommendation choices and hides repository failures", async () => {
  const state = createState();
  const app = recommendationApp(state);
  const invalid = await signedIn(request(app).post("/api/v1/recommendations"))
    .send({ ...selection, availableMinutes: 15 })
    .expect(400);
  assert.ok(invalid.body.error.fieldErrors.availableMinutes);

  state.recommendations.listPublished = async () => { throw new Error("private database detail"); };
  const unavailable = await signedIn(request(app).post("/api/v1/recommendations"))
    .send(selection)
    .expect(503);
  assert.deepEqual(unavailable.body, {
    error: {
      code: "RECOMMENDATIONS_UNAVAILABLE",
      message: "Recommendations are temporarily unavailable. Please try again.",
    },
  });
});
