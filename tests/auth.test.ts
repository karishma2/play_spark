import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { EmailAlreadyExistsError, scryptPasswordHasher, type AuthRepository, type AuthUser, type PasswordHasher } from "../server/auth.js";
import { createApp } from "../server/app.js";
import type { CatalogRepository } from "../server/catalog.js";

function createMemoryAuthRepository() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  let nextId = 1;
  const repository: AuthRepository = {
    async findUserByEmail(email) {
      return users.get(email) ?? null;
    },
    async createUser(email, passwordHash) {
      if (users.has(email)) throw new EmailAlreadyExistsError();
      const user = { id: String(nextId++).padStart(24, "0"), email, passwordHash, hasChildProfile: false };
      users.set(email, user);
      return user;
    },
    async createSession(userId, tokenHash, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    async findUserBySession(tokenHash, now) {
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= now) return null;
      return [...users.values()].find(({ id }) => id === session.userId) ?? null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
  return { repository, users, sessions };
}

const passwordHasher: PasswordHasher = {
  async hash(password) { return `test:${password}`; },
  async verify(password, encodedHash) { return encodedHash === `test:${password}`; },
};
const catalog: CatalogRepository = {
  async listGuestSamples() { return []; },
  async findGuestSample() { return null; },
};

function createAuthTestApp(auth: AuthRepository) {
  return createApp({
    databaseName: "play_spark_test",
    catalog,
    auth,
    passwordHasher,
    authCookieSecure: false,
  });
}

test("signs up with a normalized email and restores the server-side session", async () => {
  const memory = createMemoryAuthRepository();
  const agent = request.agent(createAuthTestApp(memory.repository));

  const signUp = await agent.post("/api/v1/auth/sign-up").send({
    email: "  Parent@Example.COM ",
    password: "a calm long password",
  }).expect(201);

  assert.equal(signUp.body.data.user.email, "parent@example.com");
  assert.equal(signUp.body.data.hasChildProfile, false);
  assert.equal(memory.users.get("parent@example.com")?.passwordHash, "test:a calm long password");
  assert.match(signUp.headers["set-cookie"][0], /play_spark_session=/);
  assert.match(signUp.headers["set-cookie"][0], /HttpOnly/);
  assert.match(signUp.headers["set-cookie"][0], /SameSite=Lax/);
  assert.doesNotMatch(signUp.headers["set-cookie"][0], /Secure/);

  const session = await agent.get("/api/v1/auth/session").expect(200);
  assert.equal(session.body.data.user.email, "parent@example.com");
});

test("sign-out deletes the current server-side session and clears its cookie", async () => {
  const memory = createMemoryAuthRepository();
  const agent = request.agent(createAuthTestApp(memory.repository));
  await agent.post("/api/v1/auth/sign-up").send({ email: "parent@example.com", password: "long-enough-password" });

  await agent.post("/api/v1/auth/sign-out").expect(200);
  assert.equal(memory.sessions.size, 0);
  await agent.get("/api/v1/auth/session").expect(401);
});

test("rejects duplicate accounts and invalid credentials with safe errors", async () => {
  const memory = createMemoryAuthRepository();
  const app = createAuthTestApp(memory.repository);
  await request(app).post("/api/v1/auth/sign-up").send({ email: "parent@example.com", password: "long-enough-password" }).expect(201);

  const duplicate = await request(app).post("/api/v1/auth/sign-up").send({ email: "PARENT@example.com", password: "another-long-password" }).expect(409);
  assert.equal(duplicate.body.error.code, "CONFLICT");

  const invalid = await request(app).post("/api/v1/auth/sign-in").send({ email: "unknown@example.com", password: "long-enough-password" }).expect(401);
  assert.equal(invalid.body.error.code, "UNAUTHENTICATED");
  assert.equal(invalid.body.error.message, "Email or password is incorrect.");
});

test("returns field errors before authentication work", async () => {
  const memory = createMemoryAuthRepository();
  const response = await request(createAuthTestApp(memory.repository))
    .post("/api/v1/auth/sign-up")
    .send({ email: "not-email", password: "short" })
    .expect(400);

  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.ok(response.body.error.fieldErrors.email);
  assert.ok(response.body.error.fieldErrors.password);
  assert.equal(memory.users.size, 0);
});

test("scrypt password hashes are salted and verify without storing plaintext", async () => {
  const password = "a memorable parent passphrase";
  const first = await scryptPasswordHasher.hash(password);
  const second = await scryptPasswordHasher.hash(password);

  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await scryptPasswordHasher.verify(password, first), true);
  assert.equal(await scryptPasswordHasher.verify("wrong password", first), false);
});
