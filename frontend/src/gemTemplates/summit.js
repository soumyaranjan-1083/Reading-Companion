import { createElement as h } from "react";
import { createTemplate } from "./createTemplate.js";
import { DEFAULT_GEM_PALETTE, gemPaletteById, gemPaletteStyle } from "./palettes.js";

const template = createTemplate({ id: "summit", name: "Summit", description: "Photo-lit editorial quote with a gold serif mark.", supportsPhoto: true, fonts: ["Playfair Display", "Inter"], defaultAccent: "#f2c48d" }, { quote: "'Playfair Display', 'Noto Sans Devanagari', Georgia, serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;

export function render(context, data, options) {
  const element = context?.createElement || h;
  const quote = String(data.quote || "").trim();
  const size = quote.length < 60 ? 92 : quote.length < 110 ? 80 : quote.length < 180 ? 68 : quote.length < 260 ? 58 : 50;
  const palette = options.palette || gemPaletteById(DEFAULT_GEM_PALETTE);
  const photo = options.showArtwork !== false && options.supportsPhoto !== false && data.backgroundImage && !data.imageFailed
    ? element("img", { className: "gsc-img", src: data.backgroundImage, crossOrigin: "anonymous", alt: "", onError: data.onImageError })
    : element("div", { className: "gsc-img gsc-fallback" });
  return element("div", { className: `gsc-card gt-summit palette-${palette.id}`, ref: options.cardRef, style: { width: "1080px", height: `${options.height}px`, ...gemPaletteStyle(palette) }, "data-aspect": options.aspect },
    photo,
    element("span", { className: "gsc-palette-wash", "aria-hidden": "true" }),
    element("div", { className: "gsc-shade" }),
    element("div", { className: "gsc-mesh" }),
    element("div", { className: "gsc-frame" }),
    element("div", { className: "gsc-content" },
      element("header", { className: "gsc-top" },
        element("div", { className: "gsc-kicker" }, element("span", { className: "gsc-dot" }), "Reading Companion"),
        element("h2", null, data.bookTitle || "A saved gem"),
        data.author && data.author !== "Author unknown" ? element("p", null, data.author) : null),
      element("footer", { className: "gsc-bottom" },
        element("div", { className: "gsc-mark" }, "“"),
        element("blockquote", { style: { fontSize: `${options.fitFontSize || size}px`, color: palette.primaryText, overflowWrap: "anywhere" } }, options.fitText || quote),
        element("div", { className: "gsc-rule" }),
        element("div", { className: "gsc-by" }, data.chapter ? element("span", null, `Chapter ${data.chapter}`) : null, element("span", null, "Saved gem")),
        data.savedAt ? element("div", { className: "gsc-date" }, data.savedAt) : null)));
}

export default function SummitTemplate({ data, options }) {
  return render(null, data, options);
}