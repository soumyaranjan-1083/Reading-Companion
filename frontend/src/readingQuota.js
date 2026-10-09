import { apiUrl } from "./api.js";
import { supabaseClient } from "./supabaseClient.js";

async function quotaRequest(path, method = "GET", body) {
  const { data, error } = await supabaseClient?.auth.getSession() || {};
  const token = data?.session?.access_token;
  if (error) throw error;
  if (!token) throw new Error("Sign in to check your reading time limit.");

  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Reading limit could not be loaded (${response.status}).`);
  return result;
}

export function fetchReadingQuota() {
  return quotaRequest("/api/reading/session-limit");
}

export function fetchReaderRankings() {
  return quotaRequest("/api/reading/rankings");
}

export function recordReadingUsage(seconds, readerName) {
  return quotaRequest("/api/reading/session-usage", "POST", { seconds, readerName });
}

export function setReadingLimit(userId, dailyLimitMinutes) {
  return quotaRequest("/api/reading/session-limit", "PUT", { userId, dailyLimitMinutes });
}
