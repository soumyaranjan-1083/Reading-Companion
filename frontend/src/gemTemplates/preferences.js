import { DEFAULT_GEM_PALETTE, GEM_PALETTES } from "./palettes.js";

export const GEM_CARD_PREFERENCES_KEY = "rc_gem_card_preferences";

export const DEFAULT_GEM_CARD_PREFERENCES = Object.freeze({
  template: "summit",
  palette: DEFAULT_GEM_PALETTE,
  showArtwork: true,
});

const TEMPLATES = new Set([
  "summit", "editorial-paper", "neon-terminal", "polaroid", "swiss-minimal",
  "frosted-glass", "sunset-poster", "zen-ink", "cosmic", "notebook-highlight",
  "cinema-frame", "neo-brutalist",
]);
const PALETTES = new Set(GEM_PALETTES.map((palette) => palette.id));

export function loadGemCardPreferences() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(GEM_CARD_PREFERENCES_KEY) || "null");
    return {
      template: TEMPLATES.has(saved?.template) ? saved.template : DEFAULT_GEM_CARD_PREFERENCES.template,
      palette: PALETTES.has(saved?.palette) ? saved.palette : PALETTES.has(saved?.accent) ? saved.accent : DEFAULT_GEM_CARD_PREFERENCES.palette,
      showArtwork: typeof saved?.showArtwork === "boolean" ? saved.showArtwork : true,
    };
  } catch {
    return { ...DEFAULT_GEM_CARD_PREFERENCES };
  }
}

export function saveGemCardPreferences(preferences) {
  try {
    globalThis.localStorage?.setItem(GEM_CARD_PREFERENCES_KEY, JSON.stringify({
      template: TEMPLATES.has(preferences?.template) ? preferences.template : DEFAULT_GEM_CARD_PREFERENCES.template,
      palette: PALETTES.has(preferences?.palette) ? preferences.palette : DEFAULT_GEM_CARD_PREFERENCES.palette,
      showArtwork: typeof preferences?.showArtwork === "boolean" ? preferences.showArtwork : true,
    }));
    return true;
  } catch {
    return false;
  }
}