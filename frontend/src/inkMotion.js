export const INK_MOTION_KEY = "rc_ui_v3_motion";
export const INK_HOME_PREVIEW_KEY = "rc_ui_v3_home_preview";

let homePreviewSnapshot = null;
const homePreviewListeners = new Set();
let listeningForStorage = false;

export function defaultInkMotion({ reducedMotion = false, deviceMemory } = {}) {
  return reducedMotion || (Number.isFinite(deviceMemory) && deviceMemory <= 4) ? "calm" : "rich";
}

export function loadInkMotion(storage = globalThis.localStorage, environment = globalThis) {
  try {
    const saved = storage?.getItem(INK_MOTION_KEY);
    if (saved === "calm" || saved === "rich") return saved;
  } catch {
    // Use device-sensitive defaults when storage is unavailable.
  }
  return defaultInkMotion({
    reducedMotion: environment.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    deviceMemory: environment.navigator?.deviceMemory,
  });
}

export function saveInkMotion(value, storage = globalThis.localStorage) {
  const next = value === "rich" ? "rich" : "calm";
  try { storage?.setItem(INK_MOTION_KEY, next); } catch { /* preference remains active for this view */ }
  return next;
}

export function loadHomePreview(storage = globalThis.localStorage) {
  try { return storage?.getItem(INK_HOME_PREVIEW_KEY) === "true"; } catch { return false; }
}

function currentHomePreview() {
  if (homePreviewSnapshot === null) homePreviewSnapshot = loadHomePreview();
  return homePreviewSnapshot;
}

function emitHomePreviewChange() {
  homePreviewListeners.forEach((listener) => listener());
}

function onHomePreviewStorage(event) {
  if (event.key !== INK_HOME_PREVIEW_KEY && event.key !== null) return;
  homePreviewSnapshot = loadHomePreview();
  emitHomePreviewChange();
}

export function subscribeHomePreview(listener) {
  homePreviewListeners.add(listener);
  if (!listeningForStorage && typeof window !== "undefined") {
    window.addEventListener("storage", onHomePreviewStorage);
    listeningForStorage = true;
  }
  return () => homePreviewListeners.delete(listener);
}

export function getHomePreviewSnapshot() {
  return currentHomePreview();
}

export function saveHomePreview(enabled, storage = globalThis.localStorage) {
  const next = Boolean(enabled);
  try { storage?.setItem(INK_HOME_PREVIEW_KEY, String(next)); } catch { /* preference remains active for this view */ }
  const changed = currentHomePreview() !== next;
  homePreviewSnapshot = next;
  if (changed) emitHomePreviewChange();
  return next;
}

export function toggleInkSwitch(checked, onChange, vibrate = () => navigator.vibrate?.(8)) {
  vibrate();
  onChange(!checked);
}

export function moveInkGoal(value, options, direction) {
  const selected = Math.max(0, options.indexOf(value));
  const next = (selected + direction + options.length) % options.length;
  return options[next];
}

export function createHoldConfirmController({ onConfirm, onProgress, holdMs = 1200, now = () => performance.now(), schedule = window.setInterval, cancel = window.clearInterval, vibrate = () => navigator.vibrate?.(8) }) {
  let timer = null;
  let startedAt = 0;
  let fired = false;
  let confirm = onConfirm;
  let progressUpdate = onProgress;
  const stop = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    progressUpdate(0);
  };
  return {
    start() {
      if (timer !== null) return;
      fired = false;
      startedAt = now();
      timer = schedule(() => {
        const progress = Math.min(1, (now() - startedAt) / holdMs);
        progressUpdate(progress);
        if (progress >= 1) {
          stop();
          fired = true;
          vibrate();
          confirm();
        }
      }, 32);
    },
    stop,
    keyboard() {
      if (timer !== null) stop();
      fired = true;
      vibrate();
      confirm();
    },
    updateHandlers(nextConfirm, nextProgress) {
      confirm = nextConfirm;
      progressUpdate = nextProgress;
    },
    wasConfirmed() { return fired; },
  };
}
