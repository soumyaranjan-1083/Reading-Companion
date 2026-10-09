import test from "node:test";
import assert from "node:assert/strict";
import { createOpeningMicFallback, SessionMicGate } from "./sessionMicGate.js";

test("silence stays local and the last 700ms precedes live chunks", () => {
  let time = 0;
  const sent = [];
  const gate = new SessionMicGate((chunk) => sent.push(chunk), () => sent.push("end"), { now: () => time });
  gate.accept("too-old");
  time = 800;
  gate.accept("first");
  time = 1250;
  gate.accept("second");
  assert.deepEqual(sent, []);
  gate.start();
  gate.accept("question");
  gate.end();
  assert.deepEqual(sent, ["first", "second", "question", "end"]);
  gate.accept("silent");
  assert.equal(sent.length, 4);
});

test("opening fallback opens the mic gate only while a ready session is still waiting", () => {
  const sent = [];
  let ready = true;
  let scheduled;
  let cancelled = false;
  let startedCount = 0;
  const gate = new SessionMicGate((chunk) => sent.push(chunk), () => sent.push("end"));
  const fallback = createOpeningMicFallback({
    gate,
    isReady: () => ready,
    onStarted: () => { startedCount += 1; },
    schedule: (callback, delay) => { scheduled = callback; assert.equal(delay, 6500); return 7; },
    cancelTimer: (timer) => { cancelled = timer === 7; },
  });

  gate.accept("opening-pre-roll");
  assert.equal(fallback.start(), true);
  scheduled();
  assert.deepEqual(sent, ["opening-pre-roll"]);
  assert.equal(startedCount, 1);
  fallback.cancel();
  assert.equal(cancelled, true);

  const closedGate = new SessionMicGate(() => {}, () => {});
  const closedFallback = createOpeningMicFallback({ gate: closedGate, isReady: () => ready, schedule: (callback) => callback });
  ready = false;
  assert.equal(closedGate.active, false);
  closedFallback.cancel();
});
