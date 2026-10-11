import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const profile = app.slice(app.indexOf("function ProfileScreen"), app.indexOf("function SessionScreen"));

test("passport keeps avatar upload, crop and preset selection actions", () => {
  assert.match(profile, /aria-label="Upload photo"/);
  assert.match(profile, /fileInputRef\.current\?\.click\(\)/);
  assert.match(profile, /<AvatarCropper/);
  assert.match(profile, /onClick=\{\(\) => handlePresetPick\(idx\)\}/);
  assert.match(profile, /Remove photo/);
});

test("passport keeps UID copy feedback and derives stamp thresholds from existing reader data", () => {
  assert.match(profile, /navigator\.clipboard\.writeText\(nav\.userId\)/);
  assert.match(profile, /setUidCopied\(true\)/);
  assert.match(profile, /currentStreak >= 3/);
  assert.match(profile, /currentStreak >= 7/);
  assert.match(profile, /currentStreak >= 30/);
  assert.match(profile, /savedGems > 0/);
  assert.match(profile, /startedBooks > 0/);
  assert.match(profile, /onRankChange=\{setArenaRank\}/);
});

test("all existing Profile entries retain their navigation callbacks", () => {
  for (const callback of ["goReaderRanking", "goAccount", "goSettings", "goReport", "goHelp", "goAbout", "goDocs"]) {
    assert.ok(profile.includes(callback), `missing ${callback}`);
  }
  assert.match(profile, /DocsAccessCard/);
  assert.match(profile, /APP_VERSION/);
});
