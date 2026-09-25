import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../server/config.js";

test("loads valid configuration", () => {
  const config = loadConfig({
    MONGODB_DB_NAME: "play_spark_test",
    PORT: "3100",
    SESSION_SECRET: "a-very-long-test-secret-that-is-at-least-32-characters",
  });

  assert.equal(config.databaseName, "play_spark_test");
  assert.equal(config.port, 3100);
  assert.equal(config.passwordResetBaseUrl, "http://localhost:3100");
});

test("loads paired Resend configuration and validates the application URL", () => {
  const environment = {
    SESSION_SECRET: "a-very-long-test-secret-that-is-at-least-32-characters",
    APP_BASE_URL: "https://play-spark.example/",
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "Play Spark <hello@play-spark.example>",
  };
  const config = loadConfig(environment);
  assert.equal(config.passwordResetBaseUrl, "https://play-spark.example");
  assert.equal(config.resendApiKey, "test-key");
  assert.throws(() => loadConfig({ ...environment, APP_BASE_URL: "not-a-url" }), /APP_BASE_URL/);
  assert.throws(() => loadConfig({ ...environment, RESEND_FROM_EMAIL: "" }), /configured together/);
});

test("rejects a missing or short session secret", () => {
  assert.throws(() => loadConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ SESSION_SECRET: "too-short" }), /SESSION_SECRET/);
});
