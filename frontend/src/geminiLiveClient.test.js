import test from "node:test";
import assert from "node:assert/strict";
import { GeminiLiveClient } from "./geminiLiveClient.js";
import { SessionMicGate, createOpeningMicFallback } from "./sessionMicGate.js";

test("page context precedes buffered question and audio end on first ready", async () => {
  const events = [];
  const client = new GeminiLiveClient({
    modelName: "test",
    config: {},
    handlers: {
      onReady: async () => {
        await client.sendVideoFrame("page");
        await client.sendSilentContext("page 48");
        events.push("page-ready");
      },
    },
  });
  client.session = {
    sendRealtimeInput: async (input) => {
      events.push(input.video ? "page" : input.activityStart ? "start" : input.audio ? "audio" : input.activityEnd ? "end" : "unexpected");
    },
    sendClientContent: async (content) => {
      assert.equal(content.turnComplete, false);
      events.push("page-context");
    },
    close() {},
  };
  client.setupDone = true;
  client.baseConfig = { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } };
  client.startAudio();
  await client.sendAudio("question");
  client.endAudio();
  await client._maybeReady();
  await client.audioSendChain;
  assert.deepEqual(events, ["page", "page-context", "page-ready", "start", "audio", "end"]);
  await client.close();
});

test("manual turns wait for explicit end even when the reader pauses", async () => {
  const events = [];
  const client = new GeminiLiveClient({
    modelName: "test",
    config: { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } },
    handlers: {},
  });
  client.ready = true;
  client.contextReady = true;
  client.session = { sendRealtimeInput: async (input) => {
    events.push(input.activityStart ? "start" : input.activityEnd ? "end" : "audio");
  }, close() {} };
  client.startAudio();
  void client.sendAudio("first");
  await client.audioSendChain;
  assert.deepEqual(events, ["start", "audio"]);
  void client.sendAudio("after a pause");
  client.endAudio();
  await client.audioSendChain;
  assert.deepEqual(events, ["start", "audio", "audio", "end"]);
  await client.close();
});

test("recognized wake speech is sent as a user turn and send failures propagate", async () => {
  const events = [];
  const client = new GeminiLiveClient({
    modelName: "test",
    config: {},
    handlers: {},
  });
  client.ready = true;
  client.session = {
    sendRealtimeInput: async (input) => {
      events.push(input.text);
      if (input.text === "fail") throw new Error("send failed");
    },
    close() {},
  };
  await client.sendUserText("Ember, explain this line.");
  await assert.rejects(client.sendUserText("fail"), /send failed/);
  assert.deepEqual(events, ["Ember, explain this line.", "fail"]);
  await client.close();
});

test("new page context finishes before buffered audio on a warm session", async () => {
  const events = [];
  const client = new GeminiLiveClient({
    modelName: "test",
    config: { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } },
    handlers: {},
  });
  client.ready = true;
  client.contextReady = true;
  client.session = {
    sendRealtimeInput: async (input) => events.push(input.video ? "page" : input.activityStart ? "start" : input.audio ? "audio" : "end"),
    close() {},
  };
  let finishContext;
  let contextStarted;
  const waitingForContext = new Promise((resolve) => { contextStarted = resolve; });
  const updating = client.updateContext(async () => {
    await client.sendVideoFrame("new page");
    await new Promise((resolve) => { finishContext = resolve; contextStarted(); });
    events.push("note");
  });
  await waitingForContext;
  client.startAudio();
  void client.sendAudio("question");
  client.endAudio();
  finishContext();
  await updating;
  await client.audioSendChain;
  assert.deepEqual(events, ["page", "note", "start", "audio", "end"]);
  await client.close();
});

test("pre-roll is sent after the manual activity start and before live speech", async () => {
  const events = [];
  const client = new GeminiLiveClient({
    modelName: "test",
    config: { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } },
    handlers: {},
  });
  client.ready = true;
  client.contextReady = true;
  client.session = {
    sendRealtimeInput: async (input) => events.push(input.activityStart ? "start" : input.activityEnd ? "end" : input.audio.data),
    close() {},
  };
  const gate = new SessionMicGate((chunk) => { void client.sendAudio(chunk); }, () => client.endAudio());
  gate.accept("pre-roll");
  client.startAudio();
  gate.start();
  gate.accept("question");
  gate.end();
  await client.audioSendChain;
  assert.deepEqual(events, ["start", "pre-roll", "question", "end"]);
  await client.close();
});

test("opening mic fallback retries until the session becomes ready", () => {
  const gate = new SessionMicGate(() => {}, () => {});
  let ready = false;
  let attempts = 0;
  let started = false;
  const fallback = createOpeningMicFallback({
    gate,
    isReady: () => ready,
    onStarted: () => { started = true; },
    delayMs: 50,
    schedule: (fn) => {
      attempts += 1;
      setTimeout(() => {
        if (attempts === 1) {
          ready = false;
          fn();
          return;
        }
        ready = true;
        fn();
      }, 0);
      return attempts;
    },
    cancelTimer: () => {},
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(started, true);
      assert.equal(gate.active, true);
      fallback.cancel();
      resolve();
    }, 20);
  });
});

test("paused Live sessions send no automatic audio, text, image, or context", async () => {
  const events = [];
  const client = new GeminiLiveClient({ modelName: "test", config: {}, handlers: { onStatus: (status) => events.push(status) } });
  client.ready = true;
  client.contextReady = true;
  client.session = {
    sendRealtimeInput: async (input) => events.push(input),
    sendClientContent: async (input) => events.push(input),
    close() {},
  };
  client.pause();
  client._watch();
  await client._handleTransportError(new Error("muted transport"));
  await client.sendAudio("audio");
  await client.sendText("automatic quiet note");
  client.startAudio();
  client.endAudio();
  await assert.rejects(client.sendVideoFrame("image"), /voice_session_not_ready/);
  await assert.rejects(client.sendSilentContext("context"), /voice_session_not_ready/);
  assert.deepEqual(events, []);
  assert.equal(client.audioBacklog.length, 0);
  client.resume();
  await client.sendAudio("after-unmute");
  await client.audioSendChain;
  assert.equal(events.length, 1);
  await client.close();
});

test("mute cancellation ends the active response before pausing the connection", () => {
  const events = [];
  const client = new GeminiLiveClient({ modelName: "test", config: {}, handlers: {} });
  client.ready = true;
  client.session = { sendRealtimeInput: async (input) => { events.push(input); }, close() {} };
  client.cancelResponse();
  client.pause();
  assert.deepEqual(events, [{ audioStreamEnd: true }]);
  assert.equal(client.paused, true);
  void client.close();
});
