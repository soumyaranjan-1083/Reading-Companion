export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  return totalMinutes ? `${totalMinutes}m` : `${safeSeconds}s`;
}

export function initials(name) {
  const words = String(name || "Reader").trim().split(/\s+/u).filter(Boolean);
  const first = (word) => typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)[Symbol.iterator]().next().value?.segment || ""
    : Array.from(word)[0] || "";
  return (words.length > 1 ? `${first(words[0])}${first(words.at(-1))}` : Array.from(words[0] || "R").slice(0, 2).join("")).toLocaleUpperCase();
}

export function stableReaderKeys(readers) {
  const counts = new Map();
  return readers.map((reader) => {
    const base = reader.isYou ? "you" : String(reader.name || "Reader").toLocaleLowerCase();
    const index = counts.get(base) || 0;
    counts.set(base, index + 1);
    return { ...reader, key: `${base}-${index}` };
  });
}

export function getArenaRosterLayout(readers) {
  const podium = readers.slice(0, 3);
  const mode = readers.length === 0 ? "empty" : readers.length === 1 ? "hero" : readers.length === 2 ? "duo" : "podium";
  const slots = mode === "hero" ? [2] : mode === "duo" ? [2, 1] : [2, 1, 3];
  return {
    mode,
    podium: podium.map((reader, index) => ({ ...reader, slotColumn: slots[index] })),
    rows: readers.slice(3),
    showInvite: readers.length > 0 && readers.length < 3,
  };
}

export function getArenaPlaceMessage(rankings, reader) {
  if (!reader) return "Join the race";
  if (reader.rank === 1) {
    const nextRank = rankings.filter((entry) => entry.rank > 1).sort((left, right) => left.rank - right.rank || right.totalSeconds - left.totalSeconds)[0];
    if (!nextRank) return "Leading the reading race";
    const lead = reader.totalSeconds - nextRank.totalSeconds;
    return lead > 0 ? `Leading by ${formatDuration(lead)}` : "Tied for the lead";
  }
  const nextRank = rankings.filter((entry) => entry.rank < reader.rank).sort((left, right) => right.rank - left.rank || left.totalSeconds - right.totalSeconds)[0];
  if (!nextRank) return "Your place in the Arena";
  const needed = Math.max(1, nextRank.totalSeconds - reader.totalSeconds + 1);
  return `${formatDuration(needed)} to #${nextRank.rank}`;
}

export function readerAccessibleLabel(reader) {
  return `Rank ${reader.rank}, ${reader.name}, ${formatDuration(reader.totalSeconds)}${reader.isYou ? ", you" : ""}`;
}

export function getArenaAvatarUrl(reader, failedUrl = "") {
  return typeof reader?.avatarUrl === "string" && reader.avatarUrl !== failedUrl ? reader.avatarUrl : null;
}

export function getTieMark(readers, reader) {
  return readers.filter((entry) => entry.rank === reader.rank).length > 1 ? "=" : "";
}

export function getArenaRowClassName(reader) {
  return `arena-row${reader.rank <= 10 ? " top-ten" : ""}${reader.isYou ? " is-you" : ""}`;
}

export function getArenaMotionSettings(reduceMotion) {
  return reduceMotion
    ? { rise: false, countUp: false, idle: false, fadeDuration: 0.12 }
    : { rise: true, countUp: true, idle: true, fadeDuration: 0.38 };
}
