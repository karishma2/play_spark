import assert from "node:assert/strict";
import test from "node:test";
import { completeSample, restartSample, toggleMission, type GuestProgress } from "../src/guestProgress.js";

const emptyProgress: GuestProgress = {
  completedSampleIds: [],
  completedMissions: {},
};

test("toggles guest mission completion without mutating existing progress", () => {
  const completed = toggleMission(emptyProgress, "sample-one", "mission-one");
  const uncompleted = toggleMission(completed, "sample-one", "mission-one");

  assert.deepEqual(emptyProgress.completedMissions, {});
  assert.deepEqual(completed.completedMissions, { "sample-one": ["mission-one"] });
  assert.deepEqual(uncompleted.completedMissions, { "sample-one": [] });
});

test("counts each completed guest sample only once", () => {
  const once = completeSample(emptyProgress, "sample-one");
  const twice = completeSample(once, "sample-one");

  assert.deepEqual(twice.completedSampleIds, ["sample-one"]);
});

test("restarts only the selected guest sample", () => {
  const progress: GuestProgress = {
    completedSampleIds: ["sample-one", "sample-two"],
    completedMissions: {
      "sample-one": ["mission-one", "mission-two", "mission-three"],
      "sample-two": ["mission-one"],
    },
  };

  assert.deepEqual(restartSample(progress, "sample-one"), {
    completedSampleIds: ["sample-two"],
    completedMissions: {
      "sample-one": [],
      "sample-two": ["mission-one"],
    },
  });
});
