import test from "node:test";
import assert from "node:assert/strict";
import {
  isUserId,
  normalizeDailyLimitMinutes,
  normalizeRankingPeriod,
  normalizeReaderName,
  normalizeUsageSeconds,
  parseAdminUserIds,
  quotaResponse,
  readerRankingResponse,
} from "./readingQuota.js";

test("admin ids are trimmed and case-insensitive", () => {
  assert.deepEqual([...parseAdminUserIds(" ABCD, efgh ,, ")], ["abcd", "efgh"]);
});

test("account ids must be UUIDs", () => {
  assert.equal(isUserId("f47ac10b-58cc-4372-a567-0e02b2c3d479"), true);
  assert.equal(isUserId("reader@example.com"), false);
});

test("quota inputs are bounded whole minutes and batched seconds", () => {
  assert.equal(normalizeDailyLimitMinutes(30), 30);
  assert.equal(normalizeDailyLimitMinutes(0), null);
  assert.equal(normalizeDailyLimitMinutes(1.5), null);
  assert.equal(normalizeDailyLimitMinutes(1441), null);
  assert.equal(normalizeUsageSeconds(10), 10);
  assert.equal(normalizeUsageSeconds(61), null);
});

test("reader names are trimmed, collapsed, and bounded", () => {
  assert.equal(normalizeReaderName("  Asha   Reader  "), "Asha Reader");
  assert.equal(normalizeReaderName(" "), "Reader");
  assert.equal(normalizeReaderName("R".repeat(40)).length, 30);
});

test("ranking period accepts only weekly and all-time values", () => {
  assert.equal(normalizeRankingPeriod(undefined), "all_time");
  assert.equal(normalizeRankingPeriod("weekly"), "weekly");
  assert.equal(normalizeRankingPeriod("all_time"), "all_time");
  assert.equal(normalizeRankingPeriod("monthly"), null);
});

test("ranking response validates rows and marks the signed-in reader", () => {
  assert.deepEqual(readerRankingResponse([
    { rank_position: "1", reader_name: "Asha", total_reading_seconds: "3661", user_id: "ABC" },
    { rank_position: 2, reader_name: "", total_reading_seconds: 60, user_id: "other" },
  ], "abc"), [
    { rank: 1, name: "Asha", totalSeconds: 3661, isYou: true },
    { rank: 2, name: "Reader", totalSeconds: 60, isYou: false },
  ]);
  assert.throws(() => readerRankingResponse([{ rank_position: 0, total_reading_seconds: -1 }], "abc"), /invalid_reader_rankings/);
  assert.throws(() => readerRankingResponse(null, "abc"), /invalid_reader_rankings/);
});

test("reader rankings preserve tied rank positions", () => {
  assert.deepEqual(readerRankingResponse([
    { rank_position: 1, reader_name: "Asha", total_reading_seconds: 100, user_id: "a" },
    { rank_position: 1, reader_name: "Noor", total_reading_seconds: 100, user_id: "b" },
  ], "none").map((reader) => reader.rank), [1, 1]);
});

test("quota response clamps remaining time and exposes admin capability", () => {
  assert.deepEqual(quotaResponse({ daily_limit_minutes: 30, used_seconds: 1750 }, true), {
    dailyLimitMinutes: 30,
    usedSeconds: 1750,
    remainingSeconds: 50,
    canManage: true,
  });
  assert.throws(() => quotaResponse({ daily_limit_minutes: 0, used_seconds: 0 }), /invalid_reading_quota/);
});
