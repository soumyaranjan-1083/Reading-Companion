import test from "node:test";
import assert from "node:assert/strict";
import { formatWeekCountdown, getIstWeekResetAt } from "./readerArenaTime.js";

test("weekly ranking resets at Monday 00:00 in India", () => {
  const now = new Date("2026-10-09T07:00:00.000Z");
  assert.equal(getIstWeekResetAt(now).toISOString(), "2026-10-11T18:30:00.000Z");
  assert.equal(formatWeekCountdown(now), "2d 11h");
});

test("a reset on Monday advances to the following Monday", () => {
  const mondayMidnightIst = new Date("2026-10-11T18:30:00.000Z");
  assert.equal(getIstWeekResetAt(mondayMidnightIst).toISOString(), "2026-10-18T18:30:00.000Z");
  assert.equal(formatWeekCountdown(mondayMidnightIst), "7d 0h");
});