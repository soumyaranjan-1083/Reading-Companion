import assert from "node:assert/strict";
import test from "node:test";
import { HELP_ANIMATIONS, HELP_ANIMATION_IDS, pickAnimationsByKeywords, sanitizeAnimationIds } from "./helpAnimations.js";

test("animation ids are unique", () => {
  assert.equal(new Set(HELP_ANIMATION_IDS).size, HELP_ANIMATIONS.length);
});

test("theme question maps to the appearance animation", () => {
  assert.equal(pickAnimationsByKeywords("how to change the color theme")[0], "set-appearance");
});

test("gem studio, Profile UID and deployment update questions map to animated guides", () => {
  assert.equal(pickAnimationsByKeywords("How do I choose a gem card template and square aspect ratio?")[0], "gem-download");
  assert.equal(pickAnimationsByKeywords("Where do I copy my Profile UID?")[0], "prof-card");
  assert.equal(pickAnimationsByKeywords("Do update subscribers get a deployment notification?")[0], "set-app");
});

test("sanitizeAnimationIds drops unknown ids", () => {
  assert.deepEqual(sanitizeAnimationIds(["nope", HELP_ANIMATION_IDS[0]]), [HELP_ANIMATION_IDS[0]]);
});
