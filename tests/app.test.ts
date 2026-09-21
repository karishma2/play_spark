import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../server/app.js";

const app = createApp({ databaseName: "play_spark_test" });

test("returns a healthy API response", async () => {
  const response = await request(app).get("/api/v1/health").expect(200);

  assert.deepEqual(response.body, {
    data: { service: "play-spark-api", status: "ok" },
  });
});

test("returns a safe status when MongoDB is not configured", async () => {
  const response = await request(app).get("/api/v1/connection-check").expect(200);

  assert.deepEqual(response.body, { data: { status: "not_configured" } });
});

test("returns the standard error shape for an unknown API route", async () => {
  const response = await request(app).get("/api/v1/not-a-route").expect(404);

  assert.equal(response.body.error.code, "NOT_FOUND");
});
