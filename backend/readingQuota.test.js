import test from "node:test";
import assert from "node:assert/strict";
import {
  isUserId,
  normalizeDailyLimitMinutes,
  normalizeRankingPeriod,
  normalizeReaderName,
  normalizeUsageSeconds,
  normalizeArenaAvatarUrl,
  parseAdminUserIds,
  quotaResponse,
  readerRankingResponse,
  buildArenaRankingSets,
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
    { rank: 1, name: "Asha", totalSeconds: 3661, isYou: true, avatarUrl: null },
    { rank: 2, name: "Reader", totalSeconds: 60, isYou: false, avatarUrl: null },
  ]);
  assert.throws(() => readerRankingResponse([{ rank_position: 0, total_reading_seconds: -1 }], "abc"), /invalid_reader_rankings/);
  assert.throws(() => readerRankingResponse(null, "abc"), /invalid_reader_rankings/);
});

test("weekly Arena includes every all-time participant and orders zero readers by all-time rank", () => {
  const allTime = [
    { user_id: "user-a", reader_name: "Asha", rank_position: 1, total_reading_seconds: 600, arena_show_photo: false },
    { user_id: "user-b", reader_name: "Ravi", rank_position: 2, total_reading_seconds: 300, arena_show_photo: false },
    { user_id: "user-c", reader_name: "Noor", rank_position: 3, total_reading_seconds: 60, arena_show_photo: false },
  ];
  const weekly = [
    { user_id: "user-c", reader_name: "Noor", rank_position: 1, total_reading_seconds: 120, arena_show_photo: false },
    { user_id: "user-a", reader_name: "Asha", rank_position: 2, total_reading_seconds: 60, arena_show_photo: false },
  ];
  const sets = buildArenaRankingSets(allTime, weekly);
  assert.deepEqual(sets.weekly.map((row) => [row.reader_name, row.rank_position, row.total_reading_seconds, row.all_time_rank]), [
    ["Noor", 1, 120, 3], ["Asha", 2, 60, 1], ["Ravi", null, 0, 2],
  ]);
  const publicRows = readerRankingResponse(sets.weekly, "user-b");
  assert.equal(publicRows[2].rank, null);
  assert.equal(publicRows[2].totalSeconds, 0);
  assert.equal(publicRows[2].allTimeRank, 2);
  assert.equal(publicRows[1].allTimeSeconds, 600);
  assert.equal(publicRows.some((row) => JSON.stringify(row).includes("user-")), false);
});

test("reader rankings preserve tied rank positions", () => {
  assert.deepEqual(readerRankingResponse([
    { rank_position: 1, reader_name: "Asha", total_reading_seconds: 100, user_id: "a" },
    { rank_position: 1, reader_name: "Noor", total_reading_seconds: 100, user_id: "b" },
  ], "none").map((reader) => reader.rank), [1, 1]);
});

test("Arena avatar URLs only allow HTTPS Google or the private Supabase Arena bucket", () => {
  const base = "https://project-ref.supabase.co";
  const signed = `${base}/storage/v1/object/sign/reader-arena-avatars/123e4567-e89b-12d3-a456-426614174000/avatar.jpg?token=signed`;
  assert.equal(normalizeArenaAvatarUrl(signed, base), signed);
  assert.equal(normalizeArenaAvatarUrl("/object/sign/reader-arena-avatars/123e4567-e89b-12d3-a456-426614174000/avatar.jpg?token=signed", base), signed);
  assert.equal(normalizeArenaAvatarUrl("https://lh3.googleusercontent.com/a/photo", base), "https://lh3.googleusercontent.com/a/photo");
  assert.equal(normalizeArenaAvatarUrl("http://lh3.googleusercontent.com/a/photo", base), null);
  assert.equal(normalizeArenaAvatarUrl("https://attacker.example/avatar.jpg", base), null);
  assert.equal(normalizeArenaAvatarUrl(`${base}/storage/v1/object/public/reader-arena-avatars/photo.jpg`, base), null);
  assert.equal(normalizeArenaAvatarUrl(`${base}/storage/v1/object/sign/other-bucket/photo.jpg`, base), null);
});

test("Arena ranking responses expose no account identifiers and suppress opted-out photos", () => {
  const base = "https://project-ref.supabase.co";
  const signed = `${base}/storage/v1/object/sign/reader-arena-avatars/123e4567-e89b-12d3-a456-426614174000/avatar.jpg?token=signed`;
  const result = readerRankingResponse([
    { user_id: "reader-uid", email: "reader@example.com", rank_position: 1, reader_name: "Reader", total_reading_seconds: 60, arena_show_photo: true, avatar_url: signed },
    { user_id: "hidden-uid", email: "hidden@example.com", rank_position: 2, reader_name: "Hidden", total_reading_seconds: 30, arena_show_photo: false, avatar_url: signed },
  ], "reader-uid", base);
  assert.deepEqual(result.map((reader) => reader.avatarUrl), [signed, null]);
  assert.equal(JSON.stringify(result).includes("reader-uid"), false);
  assert.equal(JSON.stringify(result).includes("example.com"), false);
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
