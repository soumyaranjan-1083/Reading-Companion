import assert from "node:assert/strict";
import test from "node:test";
import { sessionStatusView } from "./sessionStatus.js";

test("session status labels explain standby, listening, answering, muted, and reconnecting", () => {
  assert.deepEqual(sessionStatusView({ companionName: "Mira" }), { key: "standby", label: "Standby · say Mira or tap to ask" });
  assert.deepEqual(sessionStatusView({ asking: true }), { key: "listening", label: "Listening to you…" });
  assert.deepEqual(sessionStatusView({ speaking: true }), { key: "answering", label: "Answering…" });
  assert.deepEqual(sessionStatusView({ muted: true, status: "connected" }), { key: "muted", label: "Mic muted · tap to unmute" });
  assert.deepEqual(sessionStatusView({ status: "reconnecting (connection ended)" }), { key: "reconnecting", label: "Reconnecting…" });
});

test("connection failures and legacy voice have explicit labels", () => {
  assert.deepEqual(sessionStatusView({ status: "voice connection unavailable" }), { key: "offline", label: "Voice unavailable" });
  assert.deepEqual(sessionStatusView({ legacy: true, status: "connected" }), { key: "listening", label: "Listening to you…" });
});