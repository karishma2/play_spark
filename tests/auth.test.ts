import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { EmailAlreadyExistsError, scryptPasswordHasher, type AuthRepository, type AuthUser, type PasswordHasher } from "../server/auth.js";
import { createApp } from "../server/app.js";
import type { CatalogRepository } from "../server/catalog.js";
import type { AuthEmailSender } from "../server/email.js";

async function waitFor(condition: () => boolean, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for background authentication work.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function createMemoryAuthRepository() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const resetTokens = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();
  const verificationTokens = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();
  let nextId = 1;
  const repository: AuthRepository = {
    async findUserByEmail(email) {
      return users.get(email) ?? null;
    },
    async createUser(email, passwordHash) {
      if (users.has(email)) throw new EmailAlreadyExistsError();
      const user = {
        id: String(nextId++).padStart(24, "0"),
        email,
        passwordHash,
        hasChildProfile: false,
        emailVerified: false,
      };
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
    async changePassword(userId, passwordHash, currentSessionTokenHash) {
      const user = [...users.values()].find(({ id }) => id === userId);
      if (user) user.passwordHash = passwordHash;
      for (const [tokenHash, session] of sessions) {
        if (session.userId === userId && tokenHash !== currentSessionTokenHash) sessions.delete(tokenHash);
      }
    },
    async createPasswordResetToken(userId, tokenHash, expiresAt) {
      for (const [existingHash, token] of resetTokens) {
        if (token.userId === userId) resetTokens.delete(existingHash);
      }
      resetTokens.set(tokenHash, { userId, expiresAt, used: false });
    },
    async consumePasswordResetToken(tokenHash, now, passwordHash) {
      const token = resetTokens.get(tokenHash);
      if (!token || token.used || token.expiresAt <= now) return false;
      token.used = true;
      const user = [...users.values()].find(({ id }) => id === token.userId);
      if (!user) return false;
      user.passwordHash = passwordHash;
      for (const [sessionHash, session] of sessions) {
        if (session.userId === token.userId) sessions.delete(sessionHash);
      }
      return true;
    },
    async createEmailVerificationToken(userId, tokenHash, expiresAt) {
      for (const [existingHash, token] of verificationTokens) {
        if (token.userId === userId) verificationTokens.delete(existingHash);
      }
      verificationTokens.set(tokenHash, { userId, expiresAt, used: false });
    },
    async verifyEmailToken(tokenHash, now) {
      const token = verificationTokens.get(tokenHash);
      if (!token || token.used || token.expiresAt <= now) return false;
      token.used = true;
      const user = [...users.values()].find(({ id }) => id === token.userId);
      if (!user) return false;
      user.emailVerified = true;
      return true;
    },
  };
  return { repository, users, sessions, resetTokens, verificationTokens };
}

const passwordHasher: PasswordHasher = {
  async hash(password) { return `test:${password}`; },
  async verify(password, encodedHash) { return encodedHash === `test:${password}`; },
};
const catalog: CatalogRepository = {
  async listGuestSamples() { return []; },
  async findGuestSample() { return null; },
};

function createAuthTestApp(auth: AuthRepository, authEmailSender?: AuthEmailSender) {
  return createApp({
    databaseName: "play_spark_test",
    catalog,
    auth,
    passwordHasher,
    passwordResetBaseUrl: "https://play-spark.test",
    authEmailSender,
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

test("changes a password after verification and keeps only the current session", async () => {
  const memory = createMemoryAuthRepository();
  const app = createAuthTestApp(memory.repository);
  const currentAgent = request.agent(app);
  const otherAgent = request.agent(app);
  await currentAgent.post("/api/v1/auth/sign-up")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(201);
  await otherAgent.post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(200);

  const incorrect = await currentAgent.post("/api/v1/auth/change-password")
    .send({ currentPassword: "incorrect-password", newPassword: "a-new-parent-password" })
    .expect(400);
  assert.equal(incorrect.body.error.code, "INVALID_CURRENT_PASSWORD");

  await currentAgent.post("/api/v1/auth/change-password")
    .send({ currentPassword: "current-password", newPassword: "a-new-parent-password" })
    .expect(200);

  await currentAgent.get("/api/v1/auth/session").expect(200);
  await otherAgent.get("/api/v1/auth/session").expect(401);
  await request(app).post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(401);
  await request(app).post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "a-new-parent-password" })
    .expect(200);
});

test("verifies a new account with the latest 24-hour single-use email link", async () => {
  const memory = createMemoryAuthRepository();
  const sent: Array<{ to: string; verificationUrl: string }> = [];
  const emailSender: AuthEmailSender = {
    async sendPasswordReset() {},
    async sendEmailVerification(message) { sent.push(message); },
  };
  const agent = request.agent(createAuthTestApp(memory.repository, emailSender));
  const signUp = await agent.post("/api/v1/auth/sign-up")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(201);
  assert.equal(signUp.body.data.emailVerified, false);
  assert.equal(sent.length, 1);

  await agent.post("/api/v1/auth/request-email-verification").expect(202);
  assert.equal(sent.length, 2);
  const firstToken = new URL(sent[0]!.verificationUrl).searchParams.get("token");
  const latestToken = new URL(sent[1]!.verificationUrl).searchParams.get("token");
  assert.ok(firstToken);
  assert.ok(latestToken);
  const storedToken = [...memory.verificationTokens.values()][0];
  assert.ok(storedToken);
  assert.equal(storedToken.expiresAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000, true);
  assert.equal(storedToken.expiresAt.getTime() - Date.now() > 23 * 60 * 60 * 1000, true);

  await request(createAuthTestApp(memory.repository, emailSender)).post("/api/v1/auth/verify-email")
    .send({ token: firstToken })
    .expect(400);
  await agent.post("/api/v1/auth/verify-email").send({ token: latestToken }).expect(200);
  const session = await agent.get("/api/v1/auth/session").expect(200);
  assert.equal(session.body.data.emailVerified, true);
  await agent.post("/api/v1/auth/verify-email").send({ token: latestToken }).expect(400);
});

test("requests a non-enumerating reset and consumes the 30-minute token once", async () => {
  const memory = createMemoryAuthRepository();
  const sent: Array<{ to: string; resetUrl: string }> = [];
  const emailSender: AuthEmailSender = {
    async sendPasswordReset(message) { sent.push(message); },
    async sendEmailVerification() {},
  };
  const app = createAuthTestApp(memory.repository, emailSender);
  const firstAgent = request.agent(app);
  const secondAgent = request.agent(app);
  await firstAgent.post("/api/v1/auth/sign-up")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(201);
  await secondAgent.post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(200);
  memory.users.get("parent@example.com")!.emailVerified = true;

  const known = await request(app).post("/api/v1/auth/request-password-reset")
    .send({ email: "parent@example.com" })
    .expect(202);
  const unknown = await request(app).post("/api/v1/auth/request-password-reset")
    .send({ email: "unknown@example.com" })
    .expect(202);
  assert.deepEqual(known.body, unknown.body);
  await waitFor(() => sent.length === 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "parent@example.com");

  const resetUrl = new URL(sent[0]!.resetUrl);
  const token = resetUrl.searchParams.get("token");
  assert.ok(token);
  const storedToken = [...memory.resetTokens.values()][0];
  assert.ok(storedToken);
  assert.equal(storedToken.expiresAt.getTime() - Date.now() <= 30 * 60 * 1000, true);
  assert.equal(storedToken.expiresAt.getTime() - Date.now() > 29 * 60 * 1000, true);

  await request(app).post("/api/v1/auth/reset-password")
    .send({ token, newPassword: "reset-parent-password" })
    .expect(200);
  await request(app).post("/api/v1/auth/reset-password")
    .send({ token, newPassword: "another-parent-password" })
    .expect(400);
  await firstAgent.get("/api/v1/auth/session").expect(401);
  await secondAgent.get("/api/v1/auth/session").expect(401);
  await request(app).post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "current-password" })
    .expect(401);
  await request(app).post("/api/v1/auth/sign-in")
    .send({ email: "parent@example.com", password: "reset-parent-password" })
    .expect(200);

  await request(app).post("/api/v1/auth/request-password-reset")
    .send({ email: "parent@example.com" })
    .expect(202);
  await waitFor(() => sent.length === 2);
  const expiredUrl = new URL(sent[1]!.resetUrl);
  const expiredToken = expiredUrl.searchParams.get("token");
  assert.ok(expiredToken);
  const latestStoredToken = [...memory.resetTokens.values()][0];
  assert.ok(latestStoredToken);
  latestStoredToken.expiresAt = new Date(Date.now() - 1);
  await request(app).post("/api/v1/auth/reset-password")
    .send({ token: expiredToken, newPassword: "expired-reset-password" })
    .expect(400);
});

test("returns the password-reset response without waiting for email delivery", async () => {
  const memory = createMemoryAuthRepository();
  const user = await memory.repository.createUser("parent@example.com", "test:current-password");
  user.emailVerified = true;
  let deliveryStarted = false;
  let releaseDelivery!: () => void;
  const deliveryGate = new Promise<void>((resolve) => { releaseDelivery = resolve; });
  const emailSender: AuthEmailSender = {
    async sendPasswordReset() {
      deliveryStarted = true;
      await deliveryGate;
    },
    async sendEmailVerification() {},
  };

  const response = await request(createAuthTestApp(memory.repository, emailSender))
    .post("/api/v1/auth/request-password-reset")
    .send({ email: "parent@example.com" })
    .expect(202);

  assert.deepEqual(response.body, { data: { accepted: true } });
  await waitFor(() => deliveryStarted);
  releaseDelivery();
});

test("keeps authentication rate limits isolated by action", async () => {
  const memory = createMemoryAuthRepository();
  const app = createAuthTestApp(memory.repository);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await request(app).post("/api/v1/auth/sign-in")
      .send({ email: "unknown@example.com", password: "current-password" })
      .expect(401);
  }

  await request(app).post("/api/v1/auth/sign-in")
    .send({ email: "unknown@example.com", password: "current-password" })
    .expect(429);

  await request(app).post("/api/v1/auth/request-password-reset")
    .send({ email: "unknown@example.com" })
    .expect(202);

  await request(app).post("/api/v1/auth/change-password")
    .send({ currentPassword: "current-password", newPassword: "new-parent-password" })
    .expect(401);

  await request(app).post("/api/v1/auth/request-email-verification")
    .expect(401);
});
