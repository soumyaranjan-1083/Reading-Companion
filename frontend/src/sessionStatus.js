export function sessionStatusView({ muted = false, speaking = false, asking = false, status = "", legacy = false, companionName = "" } = {}) {
  const raw = String(status || "");
  let key;
  if (muted) key = "muted";
  else if (/reconnect|resum|switching to backup/i.test(raw)) key = "reconnecting";
  else if (/closed|lost|error|failed|busy|unavailable|offline/i.test(raw)) key = "offline";
  else if (speaking || /thinking/i.test(raw)) key = "answering";
  else if (asking) key = "listening";
  else if (/connecting|starting/i.test(raw)) key = "connecting";
  else if (legacy) key = "listening";
  else key = "standby";

  const labels = {
    muted: "Mic muted · tap to unmute",
    listening: "Listening to you…",
    answering: "Answering…",
    reconnecting: "Reconnecting…",
    connecting: "Getting ready…",
    offline: "Voice unavailable",
    standby: companionName ? `Standby · say ${companionName} or tap to ask` : "Standby · tap to ask",
  };
  return { key, label: labels[key] };
}
