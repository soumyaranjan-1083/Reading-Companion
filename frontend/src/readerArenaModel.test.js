import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildArenaProfile, buildWeeklyArenaData, formatDuration, getArenaAvatarUrl, getArenaGapText, getArenaMotionSettings, getArenaPlaceMessage, getArenaRosterLayout, getArenaRowClassName, getTieMark, initials, readerAccessibleLabel } from "./readerArenaModel.js";

const roster = (count) => Array.from({ length: count }, (_, index) => ({
  rank: index + 1,
  name: `Reader ${index + 1}`,
  totalSeconds: 3600 - index * 300,
  isYou: index === 0,
}));

test("roster structure adapts cleanly for 0, 1, 2, 3, 10 and 100 readers", () => {
  for (const count of [0, 1, 2, 3, 10, 100]) {
    const layout = getArenaRosterLayout(roster(count));
    assert.equal(layout.mode, count === 0 ? "empty" : count === 1 ? "hero" : count === 2 ? "duo" : "podium");
    assert.equal(layout.podium.length, Math.min(count, 3));
    assert.equal(layout.rows.length, Math.max(0, count - 3));
    assert.equal(layout.showInvite, count === 1 || count === 2);
    assert.equal(new Set(layout.podium.map((reader) => reader.slotColumn)).size, layout.podium.length);
  }
  assert.deepEqual(getArenaRosterLayout(roster(3)).podium.map((reader) => reader.slotColumn), [2, 1, 3]);
});

test("reading time keeps seconds and formats hour/minute combinations honestly", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(300), "5m");
  assert.equal(formatDuration(4800), "1h 20m");
  assert.equal(formatDuration(43200), "12h");
  assert.equal(formatDuration(0), "0s");
});

test("place message labels the lead or time needed instead of an unexplained percentage", () => {
  const readers = [
    { rank: 1, name: "One", totalSeconds: 720, isYou: true },
    { rank: 2, name: "Two", totalSeconds: 0, isYou: false },
  ];
  assert.equal(getArenaPlaceMessage(readers, readers[0]), "Leading by 12m");
  assert.equal(getArenaPlaceMessage(readers, { rank: 2, totalSeconds: 300 }), "7m to #1");
  assert.equal(getArenaPlaceMessage([{ ...readers[0], name: "Tie", totalSeconds: 720, rank: 1 }], readers[0]), "Leading the reading race");
});

test("initials and accessible row labels preserve multilingual names", () => {
  assert.equal(initials("Soumyaranjan Rout"), "SR");
  assert.equal(initials("ପଢ଼ା ମିତ୍ର"), "ପମି");
  assert.equal(initials("📚 Reader"), "📚R");
  assert.equal(readerAccessibleLabel({ rank: 1, name: "ସୁମ୍ୟ", totalSeconds: 45, isYou: true }), "Rank 1, ସୁମ୍ୟ, 45s, you");
});

test("missing and broken avatar URLs fall back to initials", () => {
  assert.equal(getArenaAvatarUrl({ name: "Reader" }), null);
  assert.equal(getArenaAvatarUrl({ avatarUrl: "https://example.test/avatar.jpg" }, "https://example.test/avatar.jpg"), null);
  assert.equal(getArenaAvatarUrl({ avatarUrl: "https://example.test/avatar.jpg" }), "https://example.test/avatar.jpg");
});

test("ties display the same rank with a tie marker and the current reader row is highlighted", () => {
  const readers = [
    { rank: 2, name: "One", totalSeconds: 300, isYou: true },
    { rank: 2, name: "Two", totalSeconds: 300, isYou: false },
  ];
  assert.equal(getTieMark(readers, readers[0]), "=");
  assert.equal(getTieMark(readers, { rank: 3 }), "");
  assert.match(getArenaRowClassName(readers[0]), /is-you/);
  assert.doesNotMatch(getArenaRowClassName(readers[1]), /is-you/);
});

test("reduced motion removes rise, count-up, and idle effects", () => {
  assert.deepEqual(getArenaMotionSettings(true), { rise: false, countUp: false, idle: false, fadeDuration: 0.12 });
  assert.equal(getArenaMotionSettings(false).rise, true);
});

test("weekly roster shows raced readers first and zero-time readers in all-time order", () => {
  const data = buildWeeklyArenaData([
    { rank: 2, weeklyRank: 2, weeklySeconds: 60, allTimeRank: 1, name: "Asha" },
    { rank: 1, weeklyRank: 1, weeklySeconds: 120, allTimeRank: 3, name: "Noor" },
    { rank: null, weeklyRank: null, weeklySeconds: 0, allTimeRank: 2, name: "Ravi" },
  ]);
  assert.equal(data.racedCount, 2);
  assert.deepEqual(data.raced.map((reader) => reader.name), ["Asha", "Noor"]);
  assert.deepEqual(data.notStarted.map((reader) => [reader.name, reader.totalSeconds, reader.rank]), [["Ravi", 0, null]]);
  assert.equal(readerAccessibleLabel(data.notStarted[0]), "Ravi, has not started this week, 0s");
  assert.doesNotMatch(getArenaRowClassName(data.notStarted[0]), /top-ten/);
});

test("Arena roster model handles both periods at 0, 1, 2, 3, 10, and 100 readers", () => {
  for (const count of [0, 1, 2, 3, 10, 100]) {
    const allTime = Array.from({ length: count }, (_, index) => ({ ...roster(count)[index], allTimeRank: index + 1, allTimeSeconds: 3600 - index * 10 }));
    const weekly = allTime.map((reader, index) => ({ ...reader, weeklyRank: index < Math.ceil(count / 2) ? index + 1 : null, weeklySeconds: index < Math.ceil(count / 2) ? (count - index) * 60 : 0 }));
    const data = buildWeeklyArenaData(weekly);
    assert.equal(data.raced.length + data.notStarted.length, count);
    assert.equal(getArenaRosterLayout(allTime).podium.length, Math.min(count, 3));
    assert.equal(getArenaRosterLayout(data.raced).rows.length, Math.max(0, data.raced.length - 3));
  }
});

test("podium gap labels explain the lead and deficit", () => {
  const leader = { rank: 1, totalSeconds: 720 };
  const runnerUp = { rank: 2, totalSeconds: 360 };
  assert.equal(getArenaGapText(leader, leader, runnerUp), "+6m ahead");
  assert.equal(getArenaGapText(runnerUp, leader, runnerUp), "6m behind #1");
});

test("profile view model contains only public aggregates and compares with the viewer", () => {
  const reader = { name: "Rinky", rank: 2, weeklyRank: 2, weeklySeconds: 300, allTimeRank: 5, allTimeSeconds: 1800, email: "private@example.com", uid: "private-uid" };
  const viewer = { isYou: true, weeklySeconds: 660, allTimeSeconds: 2400 };
  const profile = buildArenaProfile(reader, viewer, "weekly");
  assert.equal(profile.comparison, "You are 6m ahead of Rinky");
  assert.deepEqual(Object.keys(profile).sort(), ["allTimeRank", "allTimeSeconds", "avatarUrl", "comparison", "name", "weeklyRank", "weeklySeconds"].sort());
  assert.equal(JSON.stringify(profile).includes("private@example.com"), false);
  assert.equal(JSON.stringify(profile).includes("private-uid"), false);
});

test("profile sheet stays above bottom navigation and honors reduced motion", () => {
  const css = readFileSync(new URL("./ReaderArena.css", import.meta.url), "utf8");
  const component = readFileSync(new URL("./ReaderArena.jsx", import.meta.url), "utf8");
  assert.match(css, /\.arena-sheet-overlay\s*\{[^}]*var\(--bottom-nav-h/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(component, /role="dialog"\s+aria-modal="true"/);
  assert.doesNotMatch(component, /selectedReader\.(?:email|uid|userId)/);
});
