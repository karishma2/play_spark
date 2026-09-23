import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../server/app.js";
import type { CatalogRepository, GuestSample } from "../server/catalog.js";

const sampleId = "64b100000000000000000001";
const guestSample: GuestSample = {
  id: sampleId,
  title: "Build & Deliver",
  summary: "Build a delivery route.",
  durationMinutes: 20,
  setupMinutes: 2,
  parentEffort: "Low",
  messLevel: "None",
  category: "Building Blocks",
  secondaryCategory: "Pretend Play",
  imageUrl: "https://example.com/delivery.jpg",
  imageAlt: "A delivery route",
  materials: ["blocks"],
  safetyNote: "Keep the route clear.",
  wallSceneKey: "delivery-route",
  missions: [
    { id: "64b300000000000000000001", title: "Build", durationMinutes: 20, setupSteps: ["Set out blocks."], sayThis: "Build a road.", childChallenge: "Make a route.", tidyUp: "Put blocks away.", wallElement: { key: "road", label: "Road", revealMessage: "Road revealed!" } },
    { id: "64b300000000000000000002", title: "Bridge", durationMinutes: 5, setupSteps: ["Add a bridge."], sayThis: "Cross the bridge.", childChallenge: "Test the bridge.", tidyUp: "Put the bridge away.", wallElement: { key: "bridge", label: "Bridge", revealMessage: "Bridge revealed!" } },
    { id: "64b300000000000000000003", title: "Deliver", durationMinutes: 5, setupSteps: ["Add a parcel."], sayThis: "Make a delivery.", childChallenge: "Deliver the parcel.", tidyUp: "Put the parcel away.", wallElement: { key: "delivery", label: "Delivery", revealMessage: "Delivery revealed!" } },
  ],
};
const catalog: CatalogRepository = {
  async listGuestSamples() {
    const { missions, safetyNote: _safetyNote, wallSceneKey: _wallSceneKey, ...summary } = guestSample;
    return [{ ...summary, missionCount: missions.length }];
  },
  async findGuestSample(id) {
    return id === sampleId ? guestSample : null;
  },
};
const app = createApp({ databaseName: "play_spark_test", catalog });

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

test("lists guest sample Play Paths from the catalogue without mission detail", async () => {
  const response = await request(app).get("/api/v1/guest/samples").expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].missionCount, 3);
  assert.equal(response.body.data[0].missions, undefined);
});

test("returns one guest sample with ordered missions", async () => {
  const response = await request(app)
    .get(`/api/v1/guest/samples/${sampleId}`)
    .expect(200);

  assert.equal(response.body.data.title, "Build & Deliver");
  assert.deepEqual(
    response.body.data.missions.map((mission: { id: string }) => mission.id),
    ["64b300000000000000000001", "64b300000000000000000002", "64b300000000000000000003"],
  );
});

test("returns a safe error for an unavailable guest sample", async () => {
  const response = await request(app)
    .get("/api/v1/guest/samples/not-an-object-id")
    .expect(404);

  assert.deepEqual(response.body, {
    error: {
      code: "NOT_FOUND",
      message: "This sample Play Path is unavailable.",
    },
  });
});

test("returns not found for an unknown valid catalogue identifier", async () => {
  const response = await request(app)
    .get("/api/v1/guest/samples/64b100000000000000000099")
    .expect(404);

  assert.equal(response.body.error.code, "NOT_FOUND");
});

test("returns a safe error when the activity catalogue is unavailable", async () => {
  const unavailableCatalog: CatalogRepository = {
    async listGuestSamples() { throw new Error("database details must stay private"); },
    async findGuestSample() { throw new Error("database details must stay private"); },
  };
  const unavailableApp = createApp({ databaseName: "play_spark_test", catalog: unavailableCatalog });

  const response = await request(unavailableApp).get("/api/v1/guest/samples").expect(503);

  assert.deepEqual(response.body, {
    error: {
      code: "CATALOG_UNAVAILABLE",
      message: "Play Paths are temporarily unavailable. Please try again.",
    },
  });
});

test("returns the standard error shape for an unknown API route", async () => {
  const response = await request(app).get("/api/v1/not-a-route").expect(404);

  assert.equal(response.body.error.code, "NOT_FOUND");
});
