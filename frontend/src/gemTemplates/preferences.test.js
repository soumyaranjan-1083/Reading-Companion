import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GEM_CARD_PREFERENCES, GEM_CARD_PREFERENCES_KEY, loadGemCardPreferences, saveGemCardPreferences } from "./preferences.js";

test("preferences round-trip template, accent, and aspect", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveGemCardPreferences({ template: "cosmic", accent: "rose", aspect: "1:1" }), true);
  assert.equal(values.has(GEM_CARD_PREFERENCES_KEY), true);
  assert.deepEqual(loadGemCardPreferences(), { template: "cosmic", accent: "rose", aspect: "1:1" });
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