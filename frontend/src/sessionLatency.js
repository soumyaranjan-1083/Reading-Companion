export function summarizeLatencies(values) {
  const sorted = (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value) && value >= 0).sort((left, right) => left - right);
  if (!sorted.length) return { count: 0, p50: null, p95: null };
  const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95) };
}
