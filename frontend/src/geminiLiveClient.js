import { GoogleGenAI } from "@google/genai";
import { classifyLiveFailure, userNoticeForFailure } from "./friendlyErrors.js";
import { failureSummary, isKeyFailure, isModelUnavailable } from "./liveErrors.js";
import { mintLiveToken, releaseLiveLease } from "./tokenClient.js";

const WATCH_LOUD_MS = 9000;      // reader has spoken this long with no server message
const WATCH_SILENT_MS = 18000;   // and the server has been completely silent this long
const WATCH_COOLDOWN_MS = 90000; // never reconnect from the watchdog more than once per minute and a half
const STABLE_MS = 30000;         // a session this old counts as healthy: retries reset
const CONNECT_KEY_ATTEMPTS = 3;
const RECOVERY_BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

export class GeminiLiveClient {
  constructor({ modelName, fallbackModelName, config, handlers }) {
    this.modelName = modelName;
    this.fallbackModelName = fallbackModelName;
    this.baseConfig = config;
    this.handlers = handlers;
    this.session = null;
    this.activeModel = modelName;
    this.resumptionHandle = null;
    this.resumptionAt = 0;
    this.connectionRetries = 0;
    this.stopped = false;
    this.paused = false;
    this.goAwayTimer = null;
    this.setupTimer = null;
    this.setupDone = false;
    this.ready = false;
    this.contextReady = false;
    this.hasOpenedOnce = false;
    this.audioBacklog = [];
    this.audioSendChain = Promise.resolve();
    this.pendingAudioStart = false;
    this.pendingAudioEnd = false;
    this.connectionId = 0;
    this.gen = 0;
    this.reconnecting = false;
    this.failCount = 0;
    this.upSince = 0;
    this.lastServerAt = 0;
    this.loudMs = 0;
    this.lastLoudAt = 0;
    this.lastWatchAt = 0;
    this.watchTimer = null;
    this.stats = { sent: 0, recv: 0, heard: 0, err: "" };
    this.lastUserTextAt = 0;
    this.lastModelAt = 0;
    this.lastNudgeAt = 0;
    this.nudgeSentAt = 0;
    this.lastReconnectAt = 0;
    this.pendingTool = false;
    this.activeKeyIndex = null;
    this.activeKeyDay = null;
    this.pendingFailedKeyIndex = null;
    this.pendingFailedKeyDay = null;
    this.pendingFailedReason = "";
    this.keyCount = 1;
    this.leaseId = "";
    this.liveToken = "";
    this.retryTimer = null;
    this.retryResolve = null;
    this.terminalNoticeSent = false;
    this.pageHideListener = () => releaseLiveLease(this.leaseId, { beacon: true });
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.pageHideListener);
  }

  async connect(existingHandle = null) {
    if (this.stopped || this.paused) return;
    this.setupDone = false;
    this.ready = false;
    if (this.resumptionAt && Date.now() - this.resumptionAt >= 2 * 60 * 60 * 1000) {
      this.resumptionHandle = null;
      this.resumptionAt = 0;
    } else if (existingHandle) this.resumptionHandle = existingHandle;
    const gen = ++this.gen;
    this.lastServerAt = Date.now();
    this.loudMs = 0;
    this.lastLoudAt = 0;
    this.lastWatchAt = 0;
    if (!this.watchTimer) this.watchTimer = setInterval(() => this._watch(), 3000);

    const config = {
      ...this.baseConfig,
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
    };

    this.handlers.onStatus?.(this.resumptionHandle ? "resuming session" : "starting session");

    let session;
    let connectionError;
    let tokenInfo = await this._mintToken({
      failedKeyIndex: this.pendingFailedKeyIndex,
      failedKeyDay: this.pendingFailedKeyDay,
      reason: this.pendingFailedReason,
      leaseId: this.leaseId,
    });
    if (this.stopped || this.paused || gen !== this.gen) {
      await this.park();
      return;
    }
    this.keyCount = tokenInfo.keyCount || 1;
    this.activeKeyIndex = tokenInfo.keyIndex;
    this.activeKeyDay = tokenInfo.deviceDay;
    this.liveToken = tokenInfo.token;
    const maxAttempts = Math.max(1, Math.min(tokenInfo.keyCount || 1, CONNECT_KEY_ATTEMPTS));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (this.stopped || gen !== this.gen) return;
      const ai = new GoogleGenAI({ apiKey: tokenInfo.token, httpOptions: { apiVersion: "v1beta" } });
      try {
        session = await ai.live.connect({
          model: this.activeModel,
          config,
          callbacks: {
            onopen: () => {},
            onmessage: (message) => { if (gen === this.gen) this._handleMessage(message); },
            onerror: (e) => {
              if (gen !== this.gen || this.paused) return;
              console.warn("[LIVE] error", e);
              this._rememberFailedKey(e);
              this._handleTransportError(e);
            },
            onclose: (e) => {
              if (gen !== this.gen || this.paused) return;
              console.info("[LIVE] closed", e?.code, failureSummary(e));
              this._rememberFailedKey(e);
              this.handlers.onStatus?.("reconnecting (connection ended)");
              if (!this.stopped) this._handleTransportError(e || new Error("connection closed"));
            },
          },
        });
        break;
      } catch (error) {
        connectionError = error;
        if (!isKeyFailure(error) || attempt + 1 >= maxAttempts) throw error;
        this._rememberFailedKey(error);
        console.warn(`[LIVE] key ${tokenInfo.keyIndex || attempt + 1}/${maxAttempts} rejected (${failureSummary(error)}); requesting another token`);
        const nextTokenInfo = await this._mintToken({
          failedKeyIndex: this.pendingFailedKeyIndex,
          failedKeyDay: this.pendingFailedKeyDay,
          reason: this.pendingFailedReason,
          leaseId: this.leaseId,
        });
        tokenInfo = nextTokenInfo;
        this.liveToken = tokenInfo.token;
        this.activeKeyIndex = nextTokenInfo.keyIndex;
        this.activeKeyDay = nextTokenInfo.deviceDay;
      }
    }

    if (!session) throw connectionError || new Error("Gemini Live connection failed");

    if (this.stopped || this.paused || gen !== this.gen) {
      try { session.close(); } catch { /* already closed */ }
      if (this.paused && !this.stopped) await this.park();
      return;
    }
    this.session = session;
    clearTimeout(this.setupTimer);
    this.setupTimer = setTimeout(() => {
      if (gen === this.gen && !this.setupDone && !this.stopped) {
        this._handleTransportError({ message: "setup timeout" });
      }
    }, 10000);
    this._maybeReady();
    return this.session;
  }

  async _maybeReady() {
    if (this.paused || !this.session || !this.setupDone || this.ready) return;
    this.ready = true;
    this.contextReady = false;
    this.connectionId += 1;
    const connectionId = this.connectionId;
    this.connectionRetries = 0;
    this.lastReconnectAt = 0;
    this.reconnecting = false;
    this.handlers.onStatus?.("connected");
    try {
      await this.handlers.onReady?.(connectionId);
    } catch (error) {
      console.warn("[LIVE] page context failed", error);
      this._stopForFailure("transient");
      return;
    }
    if (!this.ready || !this.session || connectionId !== this.connectionId) return;
    this._flushAudio();
    if (!this.hasOpenedOnce) {
      this.hasOpenedOnce = true;
      this.handlers.onFirstReady?.();
    }
  }

  _flushAudio() {
    this.contextReady = true;
    const backlog = this.audioBacklog;
    this.audioBacklog = [];
    if (this.pendingAudioStart) this._sendAudioStart();
    for (const chunk of backlog) this.sendAudio(chunk);
    if (this.pendingAudioEnd) this.endAudio();
  }

  async updateContext(sendContext) {
    if (!this.ready || !this.contextReady || !this.session) return false;
    const session = this.session;
    this.contextReady = false;
    try {
      await sendContext();
    } catch (error) {
      void this._handleTransportError(error);
      throw error;
    }
    if (this.session === session && this.ready) this._flushAudio();
    return true;
  }

  _wait(ms) {
    return new Promise((resolve) => {
      this.retryResolve = resolve;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.retryResolve = null;
        resolve();
      }, Math.max(0, ms));
    });
  }

  _cancelWait() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const resolve = this.retryResolve;
    this.retryResolve = null;
    resolve?.();
  }

  _handleMessage(message) {
    if (this.paused) return;
    this.lastServerAt = Date.now();   // any server message = the link is alive
    const scn = message.serverContent;
    if (message.data || scn?.outputTranscription?.text || scn?.turnComplete || message.toolCall) {
      this.lastModelAt = Date.now();
      this.nudgeSentAt = 0;   // the model responded - cancel any pending escalation
    }
    if (scn?.inputTranscription?.text) this.lastUserTextAt = Date.now();
    if (message.toolCall) this.pendingTool = true;
    this.loudMs = 0;
    if (message.setupComplete) {
      this.setupDone = true;
      this.upSince = Date.now();
      clearTimeout(this.setupTimer);
      this._maybeReady();
    }
    this.stats.recv += 1;
    if (message.serverContent?.inputTranscription?.text) this.stats.heard += 1;
    if (message.sessionResumptionUpdate) {
      const u = message.sessionResumptionUpdate;
      if (u.resumable && u.newHandle) {
        this.resumptionHandle = u.newHandle;
        this.resumptionAt = Date.now();
      }
    }
    if (message.goAway) {
      const secondsLeft = Number((message.goAway.timeLeft || "5").replace("s", "")) || 5;
      clearTimeout(this.goAwayTimer);
      this.goAwayTimer = setTimeout(() => this._handleTransportError({ message: "goaway", soft: true }), Math.max(500, (secondsLeft * 1000) / 2));
      return;
    }
    if (message.usageMetadata) {
      const usage = message.usageMetadata;
      this.handlers.onUsage?.({
        at: new Date().toISOString(),
        model: this.activeModel,
        input: usage.promptTokenCount || 0,
        output: usage.responseTokenCount || 0,
        total: usage.totalTokenCount || 0,
        inputDetails: usage.promptTokensDetails || [],
        outputDetails: usage.responseTokensDetails || [],
      });
    }
    const sc = message.serverContent;
    if (sc?.inputTranscription?.text) this.quietUntil = 0;
    const quiet = this.quietUntil > Date.now();
    if (quiet && sc?.turnComplete) this.quietUntil = 0;
    if (message.data && !quiet) this.handlers.onAudio?.(message.data);
    if (sc?.outputTranscription?.text && !quiet) this.handlers.onText?.(sc.outputTranscription.text);
    if (sc?.inputTranscription?.text) this.handlers.onUserText?.(sc.inputTranscription.text);
    if (sc?.interrupted) this.handlers.onInterrupted?.();
    if (message.toolCall) this.handlers.onToolCall?.(message.toolCall);
    if (sc?.turnComplete) this.handlers.onTurnComplete?.();
  }

  // App calls this when the mic is loud. Only used by the watchdog.
  noteSpeech() {
    const now = Date.now();
    if (this.lastLoudAt && now - this.lastLoudAt < 400) this.loudMs += now - this.lastLoudAt;
    this.lastLoudAt = now;
  }

  _rememberFailedKey(error) {
    if (!isKeyFailure(error) || !this.activeKeyIndex) return;
    this.pendingFailedKeyIndex = this.activeKeyIndex;
    this.pendingFailedKeyDay = this.activeKeyDay;
    this.pendingFailedReason = failureSummary(error);
  }

  // Lets the app hand over a failed first connect so the normal retry and key-switch loop takes it from there.
  recover(error) { return this._handleTransportError(error); }

  _stopForFailure(kind) {
    if (this.terminalNoticeSent) return;
    this.terminalNoticeSent = true;
    this.stopped = true;
    this._cancelWait();
    this.ready = false;
    this.setupDone = false;
    clearTimeout(this.setupTimer);
    clearTimeout(this.goAwayTimer);
    clearInterval(this.watchTimer);
    this.watchTimer = null;
    this.gen += 1;
    try { this.session?.close(); } catch { /* already closed */ }
    this.session = null;
    this.handlers.onStatus?.("voice connection unavailable", true);
    this.handlers.onNotice?.(userNoticeForFailure(kind));
  }

  retry() {
    if (!this.stopped) return;
    this.stopped = false;
    this.terminalNoticeSent = false;
    this.connectionRetries = 0;
    this.lastReconnectAt = 0;
    void this._handleTransportError({ message: "manual retry", soft: true });
  }

  _watch() {
    if (this.stopped || this.paused || this.reconnecting || !this.ready || !this.session) return;
    const now = Date.now();
    const userRecent = this.lastUserTextAt || this.lastLoudAt || 0;
    const recentSpeech = this.lastLoudAt && now - this.lastLoudAt < WATCH_LOUD_MS;
    const serverSilentFor = now - this.lastServerAt;
    const userIdleFor = now - userRecent;

    if (!this.pendingTool && this.lastUserTextAt > this.lastModelAt) {
      // The reader was heard but the model never replied. Do one nudge, but only after a healthy delay.
      // This avoids reconnect storms when the model is simply processing or a small network hiccup occurs.
      if (now - this.lastUserTextAt > 12000 && now - this.lastNudgeAt > 20000 && !recentSpeech) {
        this.lastNudgeAt = now;
        this.nudgeSentAt = now;
        console.warn("[LIVE] reader was heard but no reply - nudging");
        this.handlers.onStatus?.("thinking…");
        if (!this.baseConfig.realtimeInputConfig?.automaticActivityDetection?.disabled) {
          void this._queueAudio({ audioStreamEnd: true });
        }
      }
      if (this.nudgeSentAt && now - this.nudgeSentAt > 15000 && userIdleFor > 15000 && serverSilentFor > WATCH_SILENT_MS) {
        this.nudgeSentAt = 0;
        console.warn("[LIVE] no reply even after nudge - reconnecting");
        this.handlers.onStatus?.("reconnecting (stuck turn)");
        this._handleTransportError({ message: "stuck-turn", soft: true });
        return;
      }
    }

    if (this.loudMs < WATCH_LOUD_MS) return;
    if (serverSilentFor < WATCH_SILENT_MS) return;
    if (userIdleFor < WATCH_LOUD_MS) return;
    if (now - this.lastWatchAt < WATCH_COOLDOWN_MS) return;
    if (this.lastReconnectAt && now - this.lastReconnectAt < WATCH_COOLDOWN_MS) return;

    this.lastWatchAt = now;
    this.loudMs = 0;
    this.lastServerAt = now;
    console.warn("[LIVE] watchdog: reader loud, server completely silent for too long - reconnecting");
    this.handlers.onStatus?.("reconnecting (silent link)");
    this._handleTransportError({ message: "watchdog", soft: true });
  }

  // One reconnect loop at a time. Everything else is dropped while it runs.
  async _handleTransportError(e) {
    if (this.stopped || this.paused || this.reconnecting) return;
    const now = Date.now();
    if (this.lastReconnectAt && now - this.lastReconnectAt < 2500) return;
    this.lastReconnectAt = now;
    this.reconnecting = true;
    try {
      if (this.upSince && Date.now() - this.upSince > STABLE_MS) this.connectionRetries = 0;
      const message = String(e?.message || e).toLowerCase();
      if (/resume|invalid handle|expired handle/.test(message)) this.resumptionHandle = null;
      const unsupportedModel = /not found|not supported for bidi|does not exist|unknown model/.test(message);
      if (this.activeModel === this.modelName && this.fallbackModelName && (unsupportedModel || isModelUnavailable(e))) {
        this.activeModel = this.fallbackModelName;
        this.handlers.onStatus?.("switching to backup model");
        await this.close({ keepHandle: true });
        await this.connect();
        return;
      }
      let attempt = 0;
      let lastError = e;
      while (!this.stopped && !this.paused && attempt < RECOVERY_BACKOFF_MS.length) {
        this.handlers.onStatus?.(`reconnecting (${attempt + 1}/${RECOVERY_BACKOFF_MS.length})`);
        await this._wait(RECOVERY_BACKOFF_MS[attempt]);
        if (this.stopped || this.paused) return;
        try {
          await this.close({ keepHandle: true });
          await this.connect(this.resumptionHandle);
          return;
        } catch (err) {
          lastError = err;
          console.warn("[LIVE] reconnect failed", failureSummary(err));
          if (isKeyFailure(err)) this._rememberFailedKey(err);
          if (err?.code === "all_keys_unavailable" && err.retryAfterSec > 0) {
            this.handlers.onStatus?.(`voice is busy, retrying in ${err.retryAfterSec} s`);
            await this._wait(err.retryAfterSec * 1000);
            continue;
          }
          attempt += 1;
        }
      }
      if (!this.stopped) this._stopForFailure(classifyLiveFailure(lastError));
    } finally {
      this.reconnecting = false;
    }
  }

  async _mintToken(args = {}) {
    const request = { ...args, leaseId: args.leaseId || this.leaseId };
    let reportPending = Boolean(request.failedKeyIndex);
    let transientAttempt = 0;
    while (!this.stopped && !this.paused) {
      try {
        const info = await mintLiveToken(request);
        this.leaseId = info.leaseId || this.leaseId;
        this.liveToken = info.token;
        this.activeKeyIndex = info.keyIndex || this.activeKeyIndex;
        this.activeKeyDay = info.deviceDay || this.activeKeyDay;
        this.keyCount = info.keyCount || this.keyCount;
        this.pendingFailedKeyIndex = null;
        this.pendingFailedKeyDay = null;
        this.pendingFailedReason = "";
        return info;
      } catch (error) {
        if (reportPending) {
          delete request.failedKeyIndex;
          delete request.failedKeyDay;
          delete request.reason;
          reportPending = false;
          this.pendingFailedKeyIndex = null;
          this.pendingFailedKeyDay = null;
          this.pendingFailedReason = "";
        }
        if (error?.code === "all_keys_unavailable") {
          const retryAfterSec = Math.max(1, Number(error.retryAfterSec) || 1);
          this.handlers.onStatus?.(`voice is busy, retrying in ${retryAfterSec} s`);
          await this._wait(retryAfterSec * 1000);
          continue;
        }
        if (classifyLiveFailure(error) === "transient" && transientAttempt < RECOVERY_BACKOFF_MS.length) {
          this.handlers.onStatus?.(`reconnecting (${transientAttempt + 1}/${RECOVERY_BACKOFF_MS.length})`);
          await this._wait(RECOVERY_BACKOFF_MS[transientAttempt]);
          transientAttempt += 1;
          continue;
        }
        throw error;
      }
    }
    throw new Error("session_stopped");
  }

  async sendAudio(base64Pcm) {
    if (this.stopped || this.paused) return;
    if (!this.ready || !this.contextReady || !this.session) {
      this.audioBacklog.push(base64Pcm);
      if (this.audioBacklog.length > 3000) {
        this.audioBacklog = [];
        this.pendingAudioEnd = false;
        this.handlers.onNotice?.({ kind: "error", title: "Question was too long to buffer", detail: "Please ask again when the voice connection is ready." });
      }
      return;
    }
    return this._queueAudio({ audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" } });
  }

  _queueAudio(input) {
    const session = this.session;
    this.audioSendChain = this.audioSendChain.then(async () => {
      if (!this.ready || this.paused || this.session !== session) return;
      try {
        await session.sendRealtimeInput(input);
        if (input.audio) this.stats.sent += 1;
        this.failCount = 0;
      } catch (err) {
        this.stats.err = String(err?.message || err).slice(0, 80);
        this.failCount += 1;
        if (this.failCount >= 5 || !input.audio) {
          this.failCount = 0;
          void this._handleTransportError(err);
        }
      }
    });
    return this.audioSendChain;
  }

  startAudio() {
    if (this.stopped || this.paused || !this.baseConfig.realtimeInputConfig?.automaticActivityDetection?.disabled) return;
    this.pendingAudioStart = true;
    this.pendingAudioEnd = false;
    if (this.contextReady) this._sendAudioStart();
  }

  _sendAudioStart() {
    if (!this.pendingAudioStart) return;
    this.pendingAudioStart = false;
    void this._queueAudio({ activityStart: {} });
  }

  async sendVideoFrame(base64Jpeg) {
    if (this.stopped || this.paused || !this.ready || !this.session) throw new Error("voice_session_not_ready");
    await this.session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: "image/jpeg" } });
  }

  async sendText(text) {
    if (this.stopped || this.paused || !this.ready || !this.session) return;
    try { await this.session.sendRealtimeInput({ text }); } catch { /* reconnect gap */ }
  }

  async sendUserText(text) {
    if (this.stopped || this.paused || !this.ready || !this.session) throw new Error("voice_session_not_ready");
    await this.session.sendRealtimeInput({ text });
  }

  async sendSilentContext(text) {
    if (this.stopped || this.paused || !this.session || !this.ready) throw new Error("voice_session_not_ready");
    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: false,
    });
  }

  endAudio() {
    if (this.stopped || this.paused) return;
    if (!this.contextReady || !this.session) {
      this.pendingAudioEnd = true;
      return;
    }
    this.pendingAudioEnd = false;
    this.pendingAudioStart = false;
    void this._queueAudio(this.baseConfig.realtimeInputConfig?.automaticActivityDetection?.disabled
      ? { activityEnd: {} } : { audioStreamEnd: true });
  }

  // Context-only note: any spoken reply the model produces to it is dropped
  // until that turn completes, the reader speaks, or the hold window ends.
  async sendQuietNote(text, holdMs = 8000) {
    if (this.stopped || this.paused || !this.ready || !this.session) return;
    this.quietUntil = Date.now() + holdMs;
    await this.sendText(text);
  }

  async sendToolResponse(functionResponses) {
    if (this.stopped || this.paused || !this.session) return;
    this.pendingTool = false;
    try {
      await this.session.sendToolResponse({ functionResponses });
    } catch (e) {
      console.warn("[LIVE] tool response failed", e);
      this._handleTransportError(e);
    }
  }

  async close({ keepHandle = false } = {}) {
    this._cancelWait();
    clearTimeout(this.goAwayTimer);
    clearTimeout(this.setupTimer);
    if (!keepHandle) {
      this.stopped = true;
      clearInterval(this.watchTimer);
      this.watchTimer = null;
      releaseLiveLease(this.leaseId);
      this.leaseId = "";
      if (typeof window !== "undefined") window.removeEventListener("pagehide", this.pageHideListener);
    }
    this.gen += 1;
    this.ready = false;
    this.contextReady = false;
    this.setupDone = false;
    this.audioBacklog = [];
    this.pendingAudioStart = false;
    this.pendingAudioEnd = false;
    try { this.session?.close(); } catch { /* already closed */ }
    this.session = null;
  }

  async park() {
    await this.close({ keepHandle: true });
    releaseLiveLease(this.leaseId);
    this.leaseId = "";
  }

  cancelResponse() {
    const session = this.session;
    if (!session || !this.ready || this.paused) return;
    this.audioBacklog = [];
    this.pendingAudioStart = false;
    this.pendingAudioEnd = false;
    const activityDetectionDisabled = this.baseConfig.realtimeInputConfig?.automaticActivityDetection?.disabled;
    void Promise.resolve(session.sendRealtimeInput(activityDetectionDisabled ? { activityEnd: {} } : { audioStreamEnd: true })).catch(() => {});
  }

  pause() {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this._cancelWait();
    clearInterval(this.watchTimer);
    this.watchTimer = null;
    clearTimeout(this.goAwayTimer);
    clearTimeout(this.setupTimer);
    this.audioBacklog = [];
    this.pendingAudioStart = false;
    this.pendingAudioEnd = false;
    if (!this.ready) {
      try { this.session?.close(); } catch { /* already closed */ }
      this.session = null;
      this.setupDone = false;
      this.contextReady = false;
    }
  }

  resume() {
    if (this.stopped || !this.paused) return false;
    this.paused = false;
    if (this.ready && !this.watchTimer) this.watchTimer = setInterval(() => this._watch(), 3000);
    return true;
  }
}