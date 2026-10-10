import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLatencies } from "./sessionLatency.js";

test("latency summary reports nearest-rank p50 and p95 without retaining samples", () => {
  assert.deepEqual(summarizeLatencies([100, 900, 300, 500, 700]), { count: 5, p50: 500, p95: 900 });
  assert.deepEqual(summarizeLatencies([]), { count: 0, p50: null, p95: null });
  assert.deepEqual(summarizeLatencies([10, NaN, -1]), { count: 1, p50: 10, p95: 10 });
});