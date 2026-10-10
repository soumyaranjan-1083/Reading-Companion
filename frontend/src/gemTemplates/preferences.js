export const GEM_CARD_PREFERENCES_KEY = "rc_gem_card_preferences";

export const DEFAULT_GEM_CARD_PREFERENCES = Object.freeze({
  template: "summit",
  accent: "noir",
  aspect: "9:16",
});

const TEMPLATES = new Set([
  "summit", "editorial-paper", "neon-terminal", "polaroid", "swiss-minimal",
  "typewriter-archive", "frosted-glass", "sunset-poster", "chalkboard", "zen-ink",
  "cosmic", "notebook-highlight", "cinema-frame", "neo-brutalist",
]);
const ACCENTS = new Set(["noir", "aurora", "sunset", "ocean", "forest", "rose", "mono", "vintage", "neon"]);
const ASPECTS = new Set(["9:16", "4:5", "1:1"]);

export function loadGemCardPreferences() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(GEM_CARD_PREFERENCES_KEY) || "null");
    return {
      template: TEMPLATES.has(saved?.template) ? saved.template : DEFAULT_GEM_CARD_PREFERENCES.template,
      accent: ACCENTS.has(saved?.accent) ? saved.accent : DEFAULT_GEM_CARD_PREFERENCES.accent,
      aspect: ASPECTS.has(saved?.aspect) ? saved.aspect : DEFAULT_GEM_CARD_PREFERENCES.aspect,
    };
  } catch {
    return { ...DEFAULT_GEM_CARD_PREFERENCES };
  }
}

export function saveGemCardPreferences(preferences) {
  try {
    globalThis.localStorage?.setItem(GEM_CARD_PREFERENCES_KEY, JSON.stringify({
      template: TEMPLATES.has(preferences?.template) ? preferences.template : DEFAULT_GEM_CARD_PREFERENCES.template,
      accent: ACCENTS.has(preferences?.accent) ? preferences.accent : DEFAULT_GEM_CARD_PREFERENCES.accent,
      aspect: ASPECTS.has(preferences?.aspect) ? preferences.aspect : DEFAULT_GEM_CARD_PREFERENCES.aspect,
    }));
    return true;
  } catch {
    return false;
  }
}