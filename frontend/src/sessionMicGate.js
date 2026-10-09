const PRE_ROLL_MS = 700;

export function createOpeningMicFallback({ gate, isReady, onStarted, delayMs = 6500, schedule = setTimeout, cancelTimer = clearTimeout }) {
  let cancelled = false;
  let started = false;
  let timer = null;
  let retries = 0;
  const maxRetries = 3;

  const start = () => {
    if (cancelled || started || !isReady() || gate.active) return false;
    started = gate.start() !== false;
    if (started) onStarted?.();
    return started;
  };

  const arm = () => {
    if (cancelled || started) return;
    timer = schedule(() => {
      if (cancelled || started) return;
      if (!isReady()) {
        if (retries < maxRetries) {
          retries += 1;
          arm();
        }
        return;
      }
      if (!start()) {
        if (retries < maxRetries) {
          retries += 1;
          arm();
        }
      }
    }, delayMs);
  };

  arm();

  return {
    start,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (timer) cancelTimer(timer);
    },
  };
}

export class SessionMicGate {
  constructor(onChunk, onEnd, { now = () => Date.now() } = {}) {
    this.onChunk = onChunk;
    this.onEnd = onEnd;
    this.now = now;
    this.rolling = [];
    this.active = false;
  }

  accept(pcm) {
    if (this.active) {
      this.onChunk(pcm);
      return;
    }
    const at = this.now();
    this.rolling.push({ at, pcm });
    while (this.rolling.length && at - this.rolling[0].at > PRE_ROLL_MS) this.rolling.shift();
  }

  start() {
    if (this.active) return false;
    this.active = true;
    for (const { pcm } of this.rolling) this.onChunk(pcm);
    this.rolling = [];
    return true;
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.onEnd();
  }

  reset() {
    this.active = false;
    this.rolling = [];
  }
}
