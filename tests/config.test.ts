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
});

test("rejects a missing or short session secret", () => {
  assert.throws(() => loadConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ SESSION_SECRET: "too-short" }), /SESSION_SECRET/);
});
