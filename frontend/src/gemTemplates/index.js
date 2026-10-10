const FONT_LOADERS = {
  "Playfair Display": () => Promise.all([import("@fontsource/playfair-display/latin-500.css"), import("@fontsource/playfair-display/latin-ext-500.css"), import("@fontsource/playfair-display/latin-600.css"), import("@fontsource/playfair-display/latin-ext-600.css")]),
  Inter: () => Promise.all([import("@fontsource/inter/latin-400.css"), import("@fontsource/inter/latin-ext-400.css"), import("@fontsource/inter/latin-500.css"), import("@fontsource/inter/latin-ext-500.css"), import("@fontsource/inter/latin-600.css"), import("@fontsource/inter/latin-ext-600.css")]),
  Caveat: () => Promise.all([import("@fontsource/caveat/latin-500.css"), import("@fontsource/caveat/latin-ext-500.css")]),
  "Special Elite": () => Promise.all([import("@fontsource/special-elite/latin-400.css"), import("@fontsource/special-elite/latin-ext-400.css")]),
  "Space Mono": () => Promise.all([import("@fontsource/space-mono/latin-400.css"), import("@fontsource/space-mono/latin-ext-400.css")]),
  "Space Grotesk": () => Promise.all([import("@fontsource/space-grotesk/latin-500.css"), import("@fontsource/space-grotesk/latin-ext-500.css"), import("@fontsource/space-grotesk/latin-600.css"), import("@fontsource/space-grotesk/latin-ext-600.css")]),
  Anton: () => Promise.all([import("@fontsource/anton/latin-400.css"), import("@fontsource/anton/latin-ext-400.css")]),
  "Noto Sans Devanagari": () => import("@fontsource/noto-sans-devanagari/devanagari-400.css"),
};

const definitions = [
  { id: "summit", name: "Summit", description: "Photo-lit editorial quote with a gold serif mark.", supportsPhoto: true, fonts: ["Playfair Display", "Inter"], defaultAccent: "#f2c48d", load: () => import("./summit.js") },
  { id: "editorial-paper", name: "Editorial Paper", description: "Warm paper, a red rule, and a large serif drop quote.", supportsPhoto: false, fonts: ["Playfair Display", "Inter"], defaultAccent: "#9f3328", load: () => import("./editorialPaper.js") },
  { id: "neon-terminal", name: "Neon Terminal", description: "A luminous terminal prompt over scan-lined black.", supportsPhoto: false, supportsEffect: false, fonts: ["Space Mono"], defaultAccent: "#54ffc1", load: () => import("./neonTerminal.js") },
  { id: "polaroid", name: "Polaroid", description: "A taped photo print with a handwritten caption.", supportsPhoto: true, fonts: ["Caveat", "Inter"], defaultAccent: "#d5b994", load: () => import("./polaroid.js") },
  { id: "swiss-minimal", name: "Swiss Minimal", description: "A strict grid, oversized grotesque type, and one color block.", supportsPhoto: false, fonts: ["Space Grotesk"], defaultAccent: "#e64a35", load: () => import("./swissMinimal.js") },
  { id: "typewriter-archive", name: "Typewriter Archive", description: "Aged paper, inked type, and a dated saved-gem stamp.", supportsPhoto: false, fonts: ["Special Elite"], defaultAccent: "#845b37", load: () => import("./typewriterArchive.js") },
  { id: "frosted-glass", name: "Frosted Glass", description: "A glassy quote panel over a soft accent-colored atmosphere.", supportsPhoto: false, fonts: ["Inter", "Playfair Display"], defaultAccent: "#6a62d9", load: () => import("./frostedGlass.js") },
  { id: "sunset-poster", name: "Sunset Poster", description: "A vivid sunset mesh with a fine white poster frame.", supportsPhoto: false, fonts: ["Anton", "Inter"], defaultAccent: "#ffb340", load: () => import("./sunsetPoster.js") },
  { id: "chalkboard", name: "Chalkboard", description: "Slate grain, chalk lettering, doodles, and a hand-drawn underline.", supportsPhoto: false, fonts: ["Caveat"], defaultAccent: "#c6dda0", load: () => import("./chalkboard.js") },
  { id: "zen-ink", name: "Zen Ink", description: "Washi paper, an ink enso, and a reader seal.", supportsPhoto: false, fonts: ["Playfair Display"], defaultAccent: "#b43f32", load: () => import("./zenInk.js") },
  { id: "cosmic", name: "Cosmic", description: "A deep starfield with a fine orbit and quiet nebula light.", supportsPhoto: false, fonts: ["Playfair Display", "Inter"], defaultAccent: "#92a8ff", load: () => import("./cosmic.js") },
  { id: "notebook-highlight", name: "Notebook Highlight", description: "Ruled paper with a red margin and highlighted key words.", supportsPhoto: false, fonts: ["Caveat", "Inter"], defaultAccent: "#efc84a", load: () => import("./notebookHighlight.js") },
  { id: "cinema-frame", name: "Cinema Frame", description: "A film still, letterbox bars, and subtitle-style quote.", supportsPhoto: true, fonts: ["Inter", "Playfair Display"], defaultAccent: "#e8c786", load: () => import("./cinemaFrame.js") },
  { id: "neo-brutalist", name: "Neo Brutalist", description: "A bright accent field, heavy ink borders, and a hard shadow.", supportsPhoto: false, fonts: ["Anton", "Inter"], defaultAccent: "#f2c84b", load: () => import("./neoBrutalist.js") },
];

const moduleCache = new Map();
const fontCache = new Map();

export const GEM_TEMPLATES = definitions.map((definition) => ({
  ...definition,
  fonts: [...new Set([...definition.fonts, "Noto Sans Devanagari"])],
  render(context, data, options) {
    return loadGemTemplate(definition.id).then((module) => module.render(context, data, options));
  },
}));

export function loadGemTemplate(templateId) {
  const definition = definitions.find((item) => item.id === templateId) || definitions[0];
  if (!moduleCache.has(definition.id)) moduleCache.set(definition.id, definition.load());
  return moduleCache.get(definition.id);
}

export async function loadGemTemplateFonts(template, sampleText = "Reading Companion हिन्दी पढ़ना") {
  await Promise.all(template.fonts.map((font) => {
    if (!fontCache.has(font)) fontCache.set(font, FONT_LOADERS[font]?.() || Promise.resolve());
    return fontCache.get(font);
  }));
  if (typeof document !== "undefined" && document.fonts) {
    await Promise.all(template.fonts.map((font) => document.fonts.load(`${font === "Noto Sans Devanagari" || font === "Special Elite" || font === "Space Mono" || font === "Anton" ? 400 : 500} 30px "${font}"`, sampleText)));
    await document.fonts.ready;
  }
}

export function templateById(templateId) {
  return GEM_TEMPLATES.find((template) => template.id === templateId) || GEM_TEMPLATES[0];
}