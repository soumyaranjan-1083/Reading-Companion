export function parseAdminUserIds(raw) {
  return new Set(String(raw || "").split(",").map((id) => id.trim().toLowerCase()).filter(Boolean));
}

export function isUserId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeDailyLimitMinutes(value) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : null;
}

export function normalizeUsageSeconds(value) {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 60 ? seconds : null;
}

export function normalizeReaderName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 30) || "Reader";
}

export function normalizeRankingPeriod(value) {
  if (value === undefined || value === "") return "all_time";
  return value === "weekly" || value === "all_time" ? value : null;
}

export function normalizeArenaAvatarUrl(value, supabaseUrl) {
  if (typeof value !== "string" || !value) return null;
  try {
    const base = new URL(supabaseUrl);
    let avatar = new URL(value, base);
    if (avatar.protocol !== "https:" || avatar.username || avatar.password) return null;
    if (avatar.origin === base.origin && avatar.pathname.startsWith("/object/sign/reader-arena-avatars/")) {
      avatar = new URL(`/storage/v1${avatar.pathname}${avatar.search}`, base);
    }
    const isGoogleAvatar = avatar.hostname === "lh3.googleusercontent.com";
    const isPrivateArenaObject = avatar.origin === base.origin
      && /^\/storage\/v1\/object\/sign\/reader-arena-avatars\/[0-9a-f-]{36}\/avatar\.(?:jpg|png|webp)$/i.test(decodeURIComponent(avatar.pathname));
    return isGoogleAvatar || isPrivateArenaObject ? avatar.href : null;
  } catch {
    return null;
  }
}

export function readerRankingResponse(rows, currentUserId, supabaseUrl = "") {
  if (!Array.isArray(rows)) throw new Error("invalid_reader_rankings");
  return rows.map((row) => {
    const unranked = row?.rank_position == null;
    const rank = unranked ? null : Number(row.rank_position);
    const totalSeconds = Number(row?.total_reading_seconds);
    if ((!unranked && (!Number.isInteger(rank) || rank < 1)) || (unranked && totalSeconds !== 0) || !Number.isSafeInteger(totalSeconds) || totalSeconds < 0) {
      throw new Error("invalid_reader_rankings");
    }
    const result = {
      rank,
      name: normalizeReaderName(row.reader_name),
      totalSeconds,
      isYou: String(row.user_id || "").toLowerCase() === String(currentUserId || "").toLowerCase(),
      avatarUrl: row.arena_show_photo === true ? normalizeArenaAvatarUrl(row.avatar_url, supabaseUrl) : null,
    };
    if (row.all_time_rank != null) result.allTimeRank = Number(row.all_time_rank);
    if (row.all_time_reading_seconds != null) result.allTimeSeconds = Number(row.all_time_reading_seconds);
    if (row.weekly_rank_position != null) result.weeklyRank = Number(row.weekly_rank_position);
    else if (Object.hasOwn(row, "weekly_rank_position")) result.weeklyRank = null;
    if (row.weekly_reading_seconds != null) result.weeklySeconds = Number(row.weekly_reading_seconds);
    if ((result.allTimeRank != null && (!Number.isInteger(result.allTimeRank) || result.allTimeRank < 1)) ||
        (result.allTimeSeconds != null && (!Number.isSafeInteger(result.allTimeSeconds) || result.allTimeSeconds < 0)) ||
        (result.weeklyRank != null && (!Number.isInteger(result.weeklyRank) || result.weeklyRank < 1)) ||
        (result.weeklySeconds != null && (!Number.isSafeInteger(result.weeklySeconds) || result.weeklySeconds < 0))) {
      throw new Error("invalid_reader_rankings");
    }
    return result;
  });
}

export function buildArenaRankingSets(allTimeRows, weeklyRows) {
  if (!Array.isArray(allTimeRows) || !Array.isArray(weeklyRows)) throw new Error("invalid_reader_rankings");
  const weeklyById = new Map(weeklyRows.map((row, index) => [String(row.user_id || "").toLowerCase(), { row, index }]));
  const weekly = allTimeRows.map((allTime) => {
    const weeklyRecord = weeklyById.get(String(allTime.user_id || "").toLowerCase());
    const raced = weeklyRecord?.row;
    return {
      ...allTime,
      rank_position: raced?.rank_position ?? null,
      total_reading_seconds: raced ? raced.total_reading_seconds : 0,
      all_time_rank: allTime.rank_position,
      all_time_reading_seconds: allTime.total_reading_seconds,
      weekly_rank_position: raced?.rank_position ?? null,
      weekly_reading_seconds: raced ? raced.total_reading_seconds : 0,
      __weeklyOrder: weeklyRecord?.index ?? Number.MAX_SAFE_INTEGER,
    };
  }).sort((left, right) => {
    const leftRank = left.rank_position == null ? Number.MAX_SAFE_INTEGER : Number(left.rank_position);
    const rightRank = right.rank_position == null ? Number.MAX_SAFE_INTEGER : Number(right.rank_position);
    return leftRank - rightRank || left.__weeklyOrder - right.__weeklyOrder || Number(left.all_time_rank) - Number(right.all_time_rank);
  }).map(({ __weeklyOrder, ...row }) => row);
  const allTime = allTimeRows.map((allTime) => {
    const raced = weeklyById.get(String(allTime.user_id || "").toLowerCase())?.row;
    return {
      ...allTime,
      all_time_rank: allTime.rank_position,
      all_time_reading_seconds: allTime.total_reading_seconds,
      weekly_rank_position: raced?.rank_position ?? null,
      weekly_reading_seconds: raced ? raced.total_reading_seconds : 0,
    };
  });
  return { weekly, allTime };
}

export function quotaResponse(row, canManage = false) {
  const dailyLimitMinutes = Number(row?.daily_limit_minutes);
  const usedSeconds = Number(row?.used_seconds);
  if (!Number.isInteger(dailyLimitMinutes) || dailyLimitMinutes < 1 || !Number.isInteger(usedSeconds) || usedSeconds < 0) {
    throw new Error("invalid_reading_quota");
  }
  const limitSeconds = dailyLimitMinutes * 60;
  return {
    dailyLimitMinutes,
    usedSeconds: Math.min(usedSeconds, limitSeconds),
    remainingSeconds: Math.max(0, limitSeconds - usedSeconds),
    canManage,
  };
}
