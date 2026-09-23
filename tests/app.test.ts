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

test("lists exactly two guest sample Play Paths without mission detail", async () => {
  const response = await request(app).get("/api/v1/guest/samples").expect(200);

  assert.equal(response.body.data.length, 2);
  assert.equal(response.body.data[0].missionCount, 3);
  assert.equal(response.body.data[0].missions, undefined);
});

test("returns one guest sample with ordered missions", async () => {
  const response = await request(app)
    .get("/api/v1/guest/samples/build-and-deliver")
    .expect(200);

  assert.equal(response.body.data.title, "Build & Deliver");
  assert.deepEqual(
    response.body.data.missions.map((mission: { id: string }) => mission.id),
    ["build-gather", "build-road", "build-deliver"],
  );
});

test("returns a safe error for an unavailable guest sample", async () => {
  const response = await request(app)
    .get("/api/v1/guest/samples/not-a-sample")
    .expect(404);

  assert.deepEqual(response.body, {
    error: {
      code: "NOT_FOUND",
      message: "This sample Play Path is unavailable.",
    },
  });
});

test("returns the standard error shape for an unknown API route", async () => {
  const response = await request(app).get("/api/v1/not-a-route").expect(404);

  assert.equal(response.body.error.code, "NOT_FOUND");
});
