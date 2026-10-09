function normalizeSpeech(text) {
  return String(text || "").toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
}

const QUIET_PATTERNS = [
  /\b(?:i am|i'm|im) (?:going to )?read(?:ing)?\b/,
  /\b(?:let me|i will|i'll) read\b/,
  /\b(?:don't|do not) interrupt\b/,
  /\b(?:be|stay) quiet\b/,
  /\b(?:main|mein|mai) (?:ab )?(?:padhne(?: ja (?:raha|rahi|rahe) hoon)?|padhna|padhta|padhti|padh(?: raha| rahi|unga|ungi))\b/,
  /\b(?:abhi|thoda) (?:padhne|padhna|padhta|padhti)\b/,
  /\bchup raho\b/,
  /\b(?:mujhe|ab) padhne do\b/,
];

const DIRECT_REQUEST_PATTERNS = [
  /\b(?:hello|hi|hey)\b/,
  /\b(?:what does|what is|what's|how do|how does|why does|explain|tell me|help me|can you|could you)\b/,
  /\b(?:meaning|matlab|samjhao|samjha(?:o)?|batao|kyun|kaise|kya hai)\b/,
  /\b(?:save this|remember this|next chapter|chapter complete|chapter khatam)\b/,
];

export function classifyVoiceIntent(transcript, companionName = "") {
  const normalized = normalizeSpeech(transcript);
  if (!normalized) return "ambient";
  if (QUIET_PATTERNS.some((pattern) => pattern.test(normalized))) return "quiet";

  const name = normalizeSpeech(companionName);
  if (name && ` ${normalized} `.includes(` ${name} `)) return "addressed";
  if (DIRECT_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized))) return "addressed";
  return "ambient";
}
