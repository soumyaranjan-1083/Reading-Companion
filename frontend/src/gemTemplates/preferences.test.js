import assert from "node:assert/strict";
import test from "node:test";
import { ASPECT_SIZES } from "./aspect.js";
import { DEFAULT_GEM_CARD_PREFERENCES, GEM_CARD_PREFERENCES_KEY, loadGemCardPreferences, saveGemCardPreferences } from "./preferences.js";

test("preferences round-trip template, palette, and artwork choice", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveGemCardPreferences({ template: "cosmic", palette: "ember", showArtwork: false }), true);
  assert.equal(values.has(GEM_CARD_PREFERENCES_KEY), true);
  assert.deepEqual(loadGemCardPreferences(), { template: "cosmic", palette: "ember", showArtwork: false });
  delete globalThis.localStorage;
});

test("legacy color choices migrate safely and unsupported export ratios are discarded", () => {
  const values = new Map([[GEM_CARD_PREFERENCES_KEY, JSON.stringify({ template: "cosmic", accent: "ocean", aspect: "1:1" })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(loadGemCardPreferences(), { template: "cosmic", palette: "ocean", showArtwork: true });
  assert.deepEqual(Object.keys(ASPECT_SIZES), ["9:16"]);
  delete globalThis.localStorage;
});

test("storage failures fall back to the Summit defaults", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("storage unavailable"); },
    setItem() { throw new Error("storage unavailable"); },
  };
  assert.deepEqual(loadGemCardPreferences(), DEFAULT_GEM_CARD_PREFERENCES);
  assert.equal(saveGemCardPreferences({ template: "summit", accent: "noir", aspect: "9:16" }), false);
  delete globalThis.localStorage;
});