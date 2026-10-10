// Mic -> AudioWorklet -> base64 16-bit PCM @16kHz. Self-healing: restarts if the mic dies or goes silent.
export class AudioCapture {
  constructor(onChunk, onLevel = null, onRestart = null) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.onRestart = onRestart;
    this.audioContext = null;
    this.stream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.keepAliveGain = null;
    this.muted = false;
    this.stopped = false;
    this.restarting = false;
    this.lastChunkAt = 0;
    this.timer = null;
    this.muteRestartTimer = null;
    this.onVis = null;
  }

  async start() {
    if (!this.stopped && this.stream) return;
    clearInterval(this.timer);
    if (this.onVis) document.removeEventListener("visibilitychange", this.onVis);
    this.stopped = false;
    await this._open();
    if (this.stopped) return;
    this.timer = setInterval(() => this._check(), 3000);
    this.onVis = () => { if (document.visibilityState === "visible") this._check(); };
    document.addEventListener("visibilitychange", this.onVis);
  }

  async _open() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    if (this.stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    if (this.audioContext.state === "suspended") await this.audioContext.resume();
    await this.audioContext.audioWorklet.addModule("/audio-processor.js");
    if (this.stopped) {
      this._teardown();
      return;
    }
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
    this.keepAliveGain = this.audioContext.createGain();
    this.keepAliveGain.gain.value = 0;
    this.workletNode.port.onmessage = (event) => {
      this.lastChunkAt = Date.now();
      if (this.muted) return;
      const int16 = new Int16Array(event.data);
      let sumSquares = 0;
      for (let i = 0; i < int16.length; i++) {
        const sample = int16[i] / 32768;
        sumSquares += sample * sample;
      }
      const rms = int16.length ? Math.sqrt(sumSquares / int16.length) : 0;
      this.onLevel?.(Math.min(1, rms * 8));
      const bytes = new Uint8Array(event.data);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      this.onChunk(btoa(binary));
    };
    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.keepAliveGain);
    this.keepAliveGain.connect(this.audioContext.destination);
    const track = this.stream.getAudioTracks()[0];
    if (track) {
      track.onended = () => { if (!this.muted) void this._restart(); };
      track.onmute = () => {
        if (this.muted) return;
        clearTimeout(this.muteRestartTimer);
        this.muteRestartTimer = setTimeout(() => {
          this.muteRestartTimer = null;
          if (track.muted && !this.stopped && track === this.stream?.getAudioTracks()[0]) this._restart();
        }, 1500);
      };
    }
    this.lastChunkAt = Date.now();
  }

  _teardown() {
    clearTimeout(this.muteRestartTimer);
    this.muteRestartTimer = null;
    try { this.sourceNode?.disconnect(); } catch { /* ignore */ }
    try { this.workletNode?.disconnect(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => { t.onended = null; t.onmute = null; t.stop(); });
    const context = this.audioContext;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    this.sourceNode = null;
    this.workletNode = null;
    this.keepAliveGain = null;
    this.stream = null;
    this.audioContext = null;
  }

  async _restart() {
    if (this.stopped || this.muted || this.restarting) return;
    this.restarting = true;
    try {
      console.info("[MIC] restarting");
      this._teardown();
      await this._open();
      if (!this.stopped) this.onRestart?.();
    } catch (e) {
      console.warn("[MIC] restart failed", e);
    } finally {
      this.restarting = false;
    }
  }

  _check() {
    if (this.stopped || this.muted || this.restarting) return;
    const ctx = this.audioContext;
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
    if (Date.now() - this.lastChunkAt > 2500) this._restart();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) {
      clearTimeout(this.muteRestartTimer);
      this.muteRestartTimer = null;
    }
  }

  stop() {
    this.stopped = true;
    this.muted = true;
    clearInterval(this.timer);
    if (this.onVis) document.removeEventListener("visibilitychange", this.onVis);
    this._teardown();
  }
}