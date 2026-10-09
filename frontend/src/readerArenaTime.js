const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getIstWeekResetAt(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const daysSinceMonday = (WEEKDAY_INDEX[values.weekday] + 6) % 7;
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - daysSinceMonday + 7, -5, -30));
}

export function formatWeekCountdown(now = new Date(), resetAt = getIstWeekResetAt(now)) {
  const remainingHours = Math.max(0, Math.floor((resetAt.getTime() - now.getTime()) / 3_600_000));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  return `${days}d ${hours}h`;
}