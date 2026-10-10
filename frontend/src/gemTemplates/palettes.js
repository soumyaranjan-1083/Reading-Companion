const PALETTES = [
  { id: "neon", name: "Neon", stops: ["#070916", "#17112c", "#35124c"], tint: "rgba(226, 56, 244, .34)", accent: "#f0a7ff", secondaryAccent: "#43e8f5", primaryText: "#fffaff", mutedText: "#d7c8e2", shadow: "rgba(6, 7, 20, .72)", quoteSurface: "#10111f" },
  { id: "sunset", name: "Sunset", stops: ["#381322", "#a83c53", "#f39c57"], tint: "rgba(242, 98, 92, .3)", accent: "#ffc06e", secondaryAccent: "#ff6e83", primaryText: "#fffaf5", mutedText: "#f0d4d0", shadow: "rgba(45, 13, 24, .72)", quoteSurface: "#2d1420" },
  { id: "ocean", name: "Ocean", stops: ["#061a2b", "#07566a", "#21b6ca"], tint: "rgba(30, 177, 203, .34)", accent: "#59e1ed", secondaryAccent: "#77a8ff", primaryText: "#f7feff", mutedText: "#c0e1e8", shadow: "rgba(4, 22, 39, .74)", quoteSurface: "#0a2231" },
  { id: "forest", name: "Forest", stops: ["#0c211b", "#176348", "#9cb956"], tint: "rgba(47, 143, 91, .34)", accent: "#b7df76", secondaryAccent: "#53cf9c", primaryText: "#f8fff8", mutedText: "#c8e0d0", shadow: "rgba(8, 29, 22, .76)", quoteSurface: "#10271f" },
  { id: "mono", name: "Mono", stops: ["#111315", "#74797b", "#f3f3ee"], tint: "rgba(160, 164, 163, .24)", accent: "#17191b", secondaryAccent: "#777d80", primaryText: "#141618", mutedText: "#505457", shadow: "rgba(14, 15, 16, .5)", quoteSurface: "#f7f7f2" },
  { id: "pastel", name: "Pastel", stops: ["#f8d9df", "#d8d7f5", "#bce9df"], tint: "rgba(216, 188, 236, .26)", accent: "#9266a8", secondaryAccent: "#4e998b", primaryText: "#282239", mutedText: "#625a72", shadow: "rgba(45, 36, 67, .34)", quoteSurface: "#fff9fc" },
  { id: "gold", name: "Gold", stops: ["#312318", "#9b672b", "#f0ce78"], tint: "rgba(211, 157, 67, .28)", accent: "#f0c667", secondaryAccent: "#b47637", primaryText: "#30220f", mutedText: "#65533a", shadow: "rgba(36, 25, 13, .64)", quoteSurface: "#fff4d9" },
  { id: "ember", name: "Ember", stops: ["#210d0a", "#8a281f", "#dc6037"], tint: "rgba(219, 73, 43, .34)", accent: "#ff986e", secondaryAccent: "#ffd166", primaryText: "#fff8f2", mutedText: "#e5c4b7", shadow: "rgba(31, 10, 8, .76)", quoteSurface: "#2a110e" },
];

export const GEM_PALETTES = Object.freeze(PALETTES.map((palette) => Object.freeze({ ...palette, stops: Object.freeze([...palette.stops]) })));
export const DEFAULT_GEM_PALETTE = "gold";
export const gemPaletteById = (id) => GEM_PALETTES.find((palette) => palette.id === id) || GEM_PALETTES[0];

function channel(color, offset) {
  return Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
}

function luminance(color) {
  const values = [channel(color, 1), channel(color, 3), channel(color, 5)].map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

export function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function gemPaletteStyle(palette) {
  return {
    "--gt-palette-gradient": `linear-gradient(145deg, ${palette.stops.join(", ")})`,
    "--gt-palette-tint": palette.tint,
    "--gt-accent": palette.accent,
    "--gt-secondary-accent": palette.secondaryAccent,
    "--gt-primary-text": palette.primaryText,
    "--gt-muted-text": palette.mutedText,
    "--gt-ink": palette.primaryText,
    "--gt-meta": palette.mutedText,
    "--gt-shadow-color": palette.shadow,
    "--gt-quote-surface": palette.quoteSurface,
  };
}
