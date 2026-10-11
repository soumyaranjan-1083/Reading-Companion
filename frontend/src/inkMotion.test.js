import assert from "node:assert/strict";
import test from "node:test";
import { createHoldConfirmController, defaultInkMotion, INK_HOME_PREVIEW_KEY, INK_MOTION_KEY, loadHomePreview, loadInkMotion, saveHomePreview, saveInkMotion } from "./inkMotion.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function holdHarness() {
  let now = 0;
  let callback;
  let cancelled = false;
  let confirmed = 0;
  const progress = [];
  const controller = createHoldConfirmController({
    onConfirm: () => { confirmed += 1; },
    onProgress: (value) => progress.push(value),
    holdMs: 1200,
    now: () => now,
    schedule: (fn) => { callback = fn; return 1; },
    cancel: () => { cancelled = true; },
    vibrate() {},
  });
  return { controller, progress, get confirmed() { return confirmed; }, get cancelled() { return cancelled; }, tick(ms) { now += ms; callback(); } };
}

test("motion defaults respect reduced motion and low-memory phones", () => {
  assert.equal(defaultInkMotion({ reducedMotion: true, deviceMemory: 8 }), "calm");
  assert.equal(defaultInkMotion({ reducedMotion: false, deviceMemory: 4 }), "calm");
  assert.equal(defaultInkMotion({ reducedMotion: false, deviceMemory: 8 }), "rich");
  assert.equal(loadInkMotion(memoryStorage(), { matchMedia: () => ({ matches: false }), navigator: { deviceMemory: 2 } }), "calm");
});

test("motion and Home preview preferences persist locally with Home preview off by default", () => {
  const storage = memoryStorage();
  assert.equal(loadInkMotion(storage, { matchMedia: () => ({ matches: false }), navigator: { deviceMemory: 8 } }), "rich");
  assert.equal(loadHomePreview(storage), false);
  assert.equal(saveInkMotion("calm", storage), "calm");
  assert.equal(saveHomePreview(true, storage), true);
  assert.equal(storage.getItem(INK_MOTION_KEY), "calm");
  assert.equal(storage.getItem(INK_HOME_PREVIEW_KEY), "true");
  assert.equal(loadHomePreview(storage), true);
});

test("hold confirms only after the full duration", () => {
  const harness = holdHarness();
  harness.controller.start();
  harness.tick(600);
  assert.equal(harness.confirmed, 0);
  harness.tick(600);
  assert.equal(harness.confirmed, 1);
  assert.equal(harness.controller.wasConfirmed(), true);
  assert.equal(harness.cancelled, true);
});

test("early release cancels hold without confirming", () => {
  const harness = holdHarness();
  harness.controller.start();
  harness.tick(500);
  harness.controller.stop();
  assert.equal(harness.confirmed, 0);
  assert.equal(harness.progress.at(-1), 0);
  assert.equal(harness.cancelled, true);
});

test("keyboard fallback confirms immediately", () => {
  const harness = holdHarness();
  harness.controller.keyboard();
  assert.equal(harness.confirmed, 1);
  assert.equal(harness.controller.wasConfirmed(), true);
});
