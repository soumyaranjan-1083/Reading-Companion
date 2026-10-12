import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getReleaseHistory } from "./reportIssueHelpers.js";

const releaseData = JSON.parse(readFileSync(new URL("../public/release-notes.json", import.meta.url), "utf8"));
const settings = readFileSync(new URL("./SettingsScreens.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./InkSettings.css", import.meta.url), "utf8");
const releaseScreen = settings.slice(settings.indexOf("function releaseHue"), settings.indexOf("function UpdateDetailsScreen"));

test("release history keeps the JSON newest-first and builds the hero from the current entry", () => {
  const releases = getReleaseHistory(releaseData.releases);
  const latest = releases[0];
  assert.equal(latest.version, "2.6.0");
  assert.equal(latest.title, "Steady Pages");
  assert.match(releaseScreen, /const latest = releases\[0\] \|\| null/);
  assert.match(releaseScreen, /<LatestReleaseCard release=\{latest\}/);
  assert.match(releaseScreen, /release\.title \|\| `Version \$\{release\.version\}`/);
  assert.match(releaseScreen, /release\.date \|\| "Recently updated"/);
  assert.match(releaseScreen, /<p>\{item\.text\}<\/p>/);
  assert.equal(latest.items.length, 8);
});

test("release accents are derived from version and older releases remain accessible and expandable", () => {
  assert.match(releaseScreen, /function releaseHue\(version\)/);
  assert.match(releaseScreen, /aria-expanded=\{open\}/);
  assert.match(releaseScreen, /aria-controls=\{detailsId\}/);
  assert.match(releaseScreen, /inert=\{!open\}/);
  assert.match(releaseScreen, /release-timeline-details\$\{open \? " open" : ""\}/);
  assert.match(styles, /\.release-timeline-details\s*\{[^}]*grid-template-rows:\s*0fr/);
  assert.match(styles, /\.release-timeline-details\.open\s*\{[^}]*grid-template-rows:\s*1fr/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("latest release hero includes title/date/version/ribbon and one-pass foil/highlight motion", () => {
  for (const token of ["release-date-chip", "release-version-emboss", "release-new-ribbon", "release-foil-sweep", "release-highlights latest-highlights"]) assert.ok(releaseScreen.includes(token), token);
  assert.match(styles, /@keyframes release-foil-sweep/);
  assert.match(styles, /@keyframes release-highlight-in/);
  assert.match(styles, /\.release-hero\s*\{[^}]*border-radius:\s*16px/);
});
