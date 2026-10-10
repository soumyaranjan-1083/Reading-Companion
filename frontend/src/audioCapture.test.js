import assert from "node:assert/strict";
import test from "node:test";
import { AudioCapture } from "./audioCapture.js";

function installAudioMocks() {
  const calls = { getUserMedia: 0, stoppedTracks: 0 };
  const track = { stop: () => { calls.stoppedTracks += 1; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class MockAudioContext {
    constructor() { this.state = "running"; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    close() { this.state = "closed"; return Promise.resolve(); }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  class MockWorklet {
    constructor() { this.port = { onmessage: null }; }
    connect() {}
    disconnect() {}
  }
  const previous = {
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    document: globalThis.document,
    AudioContext: globalThis.AudioContext,
    AudioWorkletNode: globalThis.AudioWorkletNode,
  };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: async () => { calls.getUserMedia += 1; return stream; } } } });
  globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  globalThis.AudioContext = MockAudioContext;
  globalThis.AudioWorkletNode = MockWorklet;
  return { calls, restore() {
    if (previous.navigator) Object.defineProperty(globalThis, "navigator", previous.navigator);
    else delete globalThis.navigator;
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    if (previous.AudioContext === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = previous.AudioContext;
    if (previous.AudioWorkletNode === undefined) delete globalThis.AudioWorkletNode; else globalThis.AudioWorkletNode = previous.AudioWorkletNode;
  } };
}

test("muted worklet frames produce no audio chunk or level callback", async () => {
  const mocks = installAudioMocks();
  let chunks = 0;
  let levels = 0;
  const capture = new AudioCapture(() => { chunks += 1; }, () => { levels += 1; });
  try {
    await capture.start();
    const worklet = capture.workletNode;
    const pcm = new Int16Array(320);
    pcm.fill(1200);
    worklet.port.onmessage({ data: pcm.buffer });
    assert.equal(chunks, 1);
    assert.equal(levels, 1);
    capture.setMuted(true);
    worklet.port.onmessage({ data: pcm.buffer });
    capture._check();
    assert.equal(chunks, 1);
    assert.equal(levels, 1);
    assert.equal(mocks.calls.getUserMedia, 1);
  } finally {
    capture.stop();
    mocks.restore();
  }
});
