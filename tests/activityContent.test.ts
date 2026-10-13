import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface Activity {
  id: string; durationMinutes: number;
  guestPreview: { enabled: boolean; imageUrl: string };
  wallScene: { key: string; elements: Array<{ key: string; assetRef: string }> };
  missions: Array<{ id: string; wallElementKey: string; durationMinutes: number }>;
}
const { samples } = JSON.parse(await readFile(new URL("../content/guest-samples.json", import.meta.url), "utf8")) as { samples: Activity[] };

test("expanded catalogue preserves existing identities and two guest samples with coherent mission durations", () => {
  assert.equal(samples.length, 18);
  const ids = samples.map(({ id }) => id);
  assert.equal(new Set(ids).size, 18);
  for (let i = 1; i <= 12; i++) assert.ok(ids.includes(`64b100${String(i).padStart(18, "0")}`));
  assert.deepEqual(samples.filter(({ guestPreview }) => guestPreview.enabled).map(({ id }) => id), ids.slice(0, 2));
  const missions = samples.flatMap(({ missions }) => missions.map(({ id }) => id));
  assert.equal(new Set(missions).size, missions.length);
  for (const activity of samples.slice(12)) {
    assert.equal(activity.missions.length, 3);
    assert.equal(activity.missions.reduce((sum, item) => sum + item.durationMinutes, 0), activity.durationMinutes);
    assert.equal(activity.guestPreview.enabled, false);
  }
});

test("every new activity preview and staged Mission Wall reference resolves to original local artwork", async () => {
  for (const activity of samples.slice(12)) {
    assert.match(activity.guestPreview.imageUrl, /^\/activities\/[a-z-]+\.svg$/);
    const artwork = await readFile(new URL(`../public${activity.guestPreview.imageUrl}`, import.meta.url), "utf8");
    assert.match(artwork, /viewBox="0 0 360 150"/);
    assert.ok(!/<script|<foreignObject|https?:\/\/(?!www.w3.org)/i.test(artwork));
    for (const [i, mission] of activity.missions.entries()) {
      const element = activity.wallScene.elements.find(({ key }) => key === mission.wallElementKey);
      assert.equal(element?.assetRef, `${activity.guestPreview.imageUrl}#stage-${i + 1}`);
      assert.ok(artwork.includes(`id="stage-${i + 1}"`));
    }
  }
});
