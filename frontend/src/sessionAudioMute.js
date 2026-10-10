export class SessionAudioMute {
  constructor({ capture, live, micGate, playback, stopAutoListen, stopCamera, onMuted, onStatus, onError, schedule = setTimeout, cancel = clearTimeout, releaseAfterMs = 30_000 }) {
    this.capture = capture;
    this.live = live;
    this.micGate = micGate;
    this.playback = playback;
    this.stopAutoListen = stopAutoListen;
    this.stopCamera = stopCamera;
    this.onMuted = onMuted;
    this.onStatus = onStatus;
    this.onError = onError;
    this.schedule = schedule;
    this.cancel = cancel;
    this.releaseAfterMs = releaseAfterMs;
    this.muted = false;
    this.released = false;
    this.unmuting = false;
    this.unmuteAttempt = 0;
    this.releaseTimer = null;
  }

  isMuted() {
    return this.muted;
  }

  isUnmuting() {
    return this.unmuting;
  }

  runIfUnmuted(action) {
    if (this.muted) return undefined;
    return action();
  }

  mute() {
    if (this.muted && !this.unmuting) return false;
    if (this.unmuting) {
      this.unmuteAttempt += 1;
      this.unmuting = false;
      this.capture?.setMuted(true);
      this.live?.pause?.();
      this.scheduleRelease();
      this.onStatus?.("muted");
      return true;
    }
    this.muted = true;
    this.onMuted?.(true);
    this.capture?.setMuted(true);
    this.micGate?.reset();
    this.stopAutoListen?.();
    this.stopCamera?.();
    this.playback?.clear();
    this.live?.cancelResponse?.();
    this.live?.pause?.();
    this.scheduleRelease();
    return true;
  }

  scheduleRelease() {
    this.cancel(this.releaseTimer);
    this.releaseTimer = this.schedule(() => {
      this.releaseTimer = null;
      if (!this.muted) return;
      this.released = true;
      this.capture?.stop();
      void this.live?.park?.();
    }, this.releaseAfterMs);
  }

  async unmute({ warm } = {}) {
    if (!this.muted || this.unmuting) return false;
    this.unmuting = true;
    const attempt = ++this.unmuteAttempt;
    this.cancel(this.releaseTimer);
    this.releaseTimer = null;
    this.onStatus?.("reconnecting");
    try {
      this.live?.resume?.();
      Promise.resolve(warm?.()).catch((error) => {
        if (!this.muted && attempt === this.unmuteAttempt) this.onStatus?.("reconnecting", error);
      });
      if (this.released) await this.capture?.start();
      if (attempt !== this.unmuteAttempt || !this.unmuting) {
        this.capture?.setMuted(true);
        return false;
      }
      this.capture?.setMuted(false);
      this.muted = false;
      this.released = false;
      this.unmuting = false;
      this.onMuted?.(false);
      return true;
    } catch (error) {
      if (attempt !== this.unmuteAttempt || !this.unmuting) return false;
      this.muted = true;
      this.unmuting = false;
      this.capture?.setMuted(true);
      this.live?.pause?.();
      this.onMuted?.(true);
      this.onError?.(error);
      return false;
    }
  }

  dispose() {
    this.cancel(this.releaseTimer);
    this.releaseTimer = null;
    this.unmuteAttempt += 1;
    this.unmuting = false;
  }
}
