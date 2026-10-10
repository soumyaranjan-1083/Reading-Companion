import assert from "node:assert/strict";
import test from "node:test";
import { SessionMicGate } from "./sessionMicGate.js";
import { SessionAudioMute } from "./sessionAudioMute.js";

function makeController({ startError = null } = {}) {
  const calls = [];
  let releaseCallback = null;
  const mute = new SessionAudioMute({
    capture: {
      setMuted: (value) => calls.push(`capture:${value ? "muted" : "live"}`),
      stop: () => calls.push("capture:stop"),
      start: async () => { calls.push("capture:start"); if (startError) throw startError; },
    },
    live: {
      pause: () => calls.push("live:pause"),
      resume: () => calls.push("live:resume"),
      cancelResponse: () => calls.push("live:cancel"),
      park: () => calls.push("live:park"),
    },
    micGate: { reset: () => calls.push("gate:reset") },
    playback: { clear: () => calls.push("playback:clear") },
    stopAutoListen: () => calls.push("vad:stop"),
    stopCamera: () => calls.push("camera:stop"),
    onMuted: (value) => calls.push(`ui:${value ? "muted" : "unmuted"}`),
    onStatus: (value) => calls.push(`status:${value}`),
    onError: () => calls.push("permission:error"),
    schedule: (callback, ms) => { calls.push(`timer:${ms}`); releaseCallback = callback; return 1; },
    cancel: () => { calls.push("timer:cancel"); releaseCallback = null; },
  });
  return { mute, calls, release: () => releaseCallback?.() };
}

test("mute gates automatic classifier, model, and network work and cancels playback", () => {
  const { mute, calls } = makeController();
  const mockClients = {
    classifier: { classify: () => calls.push("classifier") },
    model: { sendAudio: () => calls.push("model") },
    network: { post: () => calls.push("network") },
  };
  assert.equal(mute.mute(), true);
  mute.runIfUnmuted(() => mockClients.classifier.classify());
  mute.runIfUnmuted(() => mockClients.model.sendAudio());
  mute.runIfUnmuted(() => mockClients.network.post());
  assert.equal(mute.isMuted(), true);
  assert.deepEqual(calls.filter((call) => ["classifier", "model", "network"].includes(call)), []);
  assert.ok(calls.includes("playback:clear"));
  assert.ok(calls.includes("live:cancel"));
  assert.ok(calls.includes("live:pause"));
});

test("hardware and Live lease are released at 30 seconds and a warm unmute resumes", async () => {
  const { mute, calls, release } = makeController();
  mute.mute();
  assert.ok(calls.includes("timer:30000"));
  release();
  assert.ok(calls.includes("capture:stop"));
  assert.ok(calls.includes("live:park"));
  let warmCalls = 0;
  assert.equal(await mute.unmute({ warm: () => { warmCalls += 1; } }), true);
  assert.ok(calls.includes("capture:start"));
  assert.ok(calls.includes("live:resume"));
  assert.equal(warmCalls, 1);
  assert.equal(mute.isMuted(), false);
});

test("a warm-window unmute keeps hardware and warms without reopening capture", async () => {
  const { mute, calls } = makeController();
  mute.mute();
  assert.equal(await mute.unmute({ warm: () => calls.push("warm") }), true);
  assert.equal(calls.includes("capture:start"), false);
  assert.ok(calls.includes("warm"));
});

test("microphone permission failure leaves the session muted", async () => {
  const { mute, calls, release } = makeController({ startError: new Error("permission denied") });
  mute.mute();
  release();
  await mute.unmute();
  assert.equal(mute.isMuted(), true);
  assert.ok(calls.includes("permission:error"));
  assert.equal(calls.filter((call) => call === "ui:muted").length, 2);
});

test("rapid repeated mute toggles do not duplicate stop/release work", () => {
  const { mute, calls } = makeController();
  assert.equal(mute.mute(), true);
  assert.equal(mute.mute(), false);
  assert.equal(calls.filter((call) => call === "live:pause").length, 1);
  mute.dispose();
});

test("a second mute cancels an in-progress cold microphone reacquisition", async () => {
  let finishStart;
  let releaseTimer;
  const calls = [];
  const mute = new SessionAudioMute({
    capture: { setMuted: (value) => calls.push(`capture:${value}`), stop: () => calls.push("stop"), start: () => new Promise((resolve) => { finishStart = resolve; }) },
    live: { pause: () => calls.push("pause"), resume: () => calls.push("resume"), park() {} },
    schedule: (callback) => { releaseTimer = callback; return 1; },
    cancel() {},
  });
  mute.mute();
  releaseTimer();
  const unmuting = mute.unmute();
  assert.equal(mute.isUnmuting(), true);
  assert.equal(mute.mute(), true);
  finishStart();
  assert.equal(await unmuting, false);
  assert.equal(mute.isMuted(), true);
  assert.ok(calls.includes("capture:true"));
  assert.equal(calls.includes("capture:false"), false);
  assert.equal(calls.filter((call) => call === "pause").length, 2);
});

test("speech after unmute stays in the 700ms pre-roll and flushes when a question starts", async () => {
  const sent = [];
  let now = 1000;
  const gate = new SessionMicGate((chunk) => sent.push(chunk), () => sent.push("end"), { now: () => now });
  const { mute } = makeController();
  mute.micGate = gate;
  mute.mute();
  await mute.unmute();
  gate.accept("first words");
  now += 100;
  gate.accept("next words");
  gate.start();
  gate.accept("live words");
  gate.end();
  assert.deepEqual(sent, ["first words", "next words", "live words", "end"]);
});