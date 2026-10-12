import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const profile = app.slice(app.indexOf("function ProfileScreen"), app.indexOf("function SessionScreen"));
const styles = readFileSync(new URL("./InkProfile.css", import.meta.url), "utf8");

test("Aurora Halo keeps avatar upload, crop, preset selection, and photo removal", () => {
  assert.match(profile, /aria-label="Change avatar"/);
  assert.match(profile, /fileInputRef\.current\?\.click\(\)/);
  assert.match(profile, /<AvatarCropper/);
  assert.match(profile, /onClick=\{\(\) => handlePresetPick\(index\)\}/);
  assert.match(profile, /Choose a photo/);
  assert.match(profile, /Remove photo/);
});

test("ID chip copies the full UID, can reveal it, and gives feedback", () => {
  assert.match(profile, /navigator\.clipboard\.writeText\(nav\.userId\)/);
  assert.match(profile, /document\.execCommand\("copy"\)/);
  assert.match(profile, /setUidCopied\(true\)/);
  assert.match(profile, /uidExpanded && nav\.userId \? nav\.userId : uidShort/);
  assert.match(profile, /navigator\.vibrate\?\.\(8\)/);
});

test("stamps retain their existing thresholds and live in a separate sheet", () => {
  assert.match(profile, /currentStreak >= 3/);
  assert.match(profile, /currentStreak >= 7/);
  assert.match(profile, /currentStreak >= 30/);
  assert.match(profile, /savedGems > 0/);
  assert.match(profile, /startedBooks > 0/);
  assert.match(profile, /setStampsSheetOpen\(true\)/);
  assert.match(profile, /className="profile-stamp-grid"/);
  assert.match(profile, /onRankChange=\{setArenaRank\}/);
});

test("companion sheet and stats preserve their existing choices and destinations", () => {
  for (const companion of ["owl", "robot", "sprout", "fox", "book"]) assert.ok(profile.includes(`"${companion}"`));
  assert.match(profile, /setMascot\(id\)/);
  for (const callback of ["goReaderRanking", "goGems", "goLibrary"]) assert.ok(profile.includes(`onClick={nav.${callback}}`), callback);
});

test("all Profile destination entries and the version footer remain wired", () => {
  for (const callback of ["goReaderRanking", "goAccount", "goSettings", "goReport", "goHelp", "goAbout", "goDocs"]) {
    assert.ok(profile.includes(callback), `missing ${callback}`);
  }
  assert.match(profile, /DocsAccessCard/);
  assert.match(profile, /APP_VERSION/);
});

test("Aurora Halo stays within the phone layout and clears the restored dock", () => {
  assert.match(profile, /className="profile-hero"/);
  assert.match(styles, /\.profile-halo\s*\{[^}]*width:\s*176px/);
  assert.match(styles, /\.profile-stat-pills\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.profile-link-row\s*\{[^}]*min-height:\s*64px/);
  assert.match(styles, /\.pf-screen\.pf-aurora-screen\s*\{[^}]*padding: calc\(10px \+ env\(safe-area-inset-top[^}]*var\(--bottom-nav-h, 72px\) \+ 16px \+ env\(safe-area-inset-bottom/);
  assert.match(styles, /@media\s*\(max-width:\s*375px\)/);
  assert.match(profile, /className="profile-stamp-grid"/);
  assert.match(profile, /className="profile-links"/);
  assert.doesNotMatch(profile, /className="pc passport-card"/);
});
