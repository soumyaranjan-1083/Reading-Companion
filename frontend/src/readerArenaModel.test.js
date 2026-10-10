import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, getArenaAvatarUrl, getArenaMotionSettings, getArenaPlaceMessage, getArenaRosterLayout, getArenaRowClassName, getTieMark, initials, readerAccessibleLabel } from "./readerArenaModel.js";

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
