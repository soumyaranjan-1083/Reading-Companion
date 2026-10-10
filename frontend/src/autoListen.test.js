import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { classifyUtterance } from "./autoListen.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("retries a transient classifier failure before returning the decision", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ ask: true, reading: false }) };
  };

  const result = await classifyUtterance(new Float32Array([0.1]));
  assert.deepEqual(result, { ask: true, reading: false });
  assert.equal(calls, 2);
});

test("does not retry a non-transient classifier response", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 400 };
  };

  await assert.rejects(classifyUtterance(new Float32Array([0.1])), /classify_400/);
  assert.equal(calls, 1);
});

test("an aborted classifier request stops immediately without retrying", async () => {
  let calls = 0;
  globalThis.fetch = (_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  };
  const controller = new AbortController();
  const request = classifyUtterance(new Float32Array([0.1]), { signal: controller.signal });
  controller.abort(new DOMException("Muted", "AbortError"));
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(calls, 1);
});
