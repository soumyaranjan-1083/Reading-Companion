import { createElement as h } from "react";
import { fitQuoteText } from "./quoteFit.js";
import { ASPECT_SIZES } from "./aspect.js";
import { DEFAULT_GEM_PALETTE, gemPaletteById, gemPaletteStyle } from "./palettes.js";

const FONT_SIZE = {
  "editorial-paper": 84, "neon-terminal": 66, polaroid: 60, "swiss-minimal": 92,
  "frosted-glass": 74, "sunset-poster": 86, "zen-ink": 72, cosmic: 68,
  "notebook-highlight": 64, "cinema-frame": 64, "neo-brutalist": 78,
};

export function quoteAreaForTemplate(templateId, aspectId = "9:16") {
  const aspect = ASPECT_SIZES[aspectId] || ASPECT_SIZES["9:16"];
  return templateId === "polaroid"
    ? { width: 780, height: Math.round(aspect.height * 0.3) }
    : { width: Math.round(aspect.width * 0.78), height: Math.round(aspect.height * 0.42) };
}

export function fitTemplateQuote(templateId, quote, aspectId = "9:16") {
  const area = quoteAreaForTemplate(templateId, aspectId);
  return fitQuoteText(quote, { ...area, maxFontSize: Math.max(56, FONT_SIZE[templateId] || 72), minFontSize: 56, lineHeight: 1.2 });
}

function initials(value) {
  const words = String(value || "RC").trim().split(/\s+/u).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.slice(0, 2) || "RC").toLocaleUpperCase();
}

function highlightWords(value) {
  const words = [...new Set(String(value).match(/[\p{L}\p{N}]{5,}/gu) || [])];
  return new Set(words.sort((left, right) => Array.from(right).length - Array.from(left).length).slice(0, 3).map((word) => word.toLocaleLowerCase()));
}

function quoteNodes(text, templateId) {
  if (templateId !== "notebook-highlight") return text;
  const highlighted = highlightWords(text);
  return String(text).split(/(\s+)/u).map((part, index) => {
    if (/^\s+$/u.test(part)) return part;
    const normalized = part.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return h(highlighted.has(normalized) ? "mark" : "span", { key: index }, part);
  });
}

function polaroidFrame(data, image) {
  return h("div", { className: "gt-polaroid-frame" },
    h("div", { className: "gt-polaroid-photo" }, image || h("div", { className: "gt-photo-fallback" })),
    h("span", { className: "gt-tape", "aria-hidden": "true" }));
}

function ornament(templateId, data) {
  if (templateId === "zen-ink") return h("svg", { className: "gt-enso", viewBox: "0 0 700 700", "aria-hidden": "true" }, h("path", { d: "M350 52C516 49 648 179 646 346 644 514 510 648 343 647 176 646 51 517 53 350 55 193 171 68 318 54", fill: "none", stroke: "var(--gt-secondary-accent)", strokeWidth: "34", strokeLinecap: "round", strokeDasharray: "1710 230", opacity: ".2" }));
  if (templateId === "notebook-highlight") return h("div", { className: "gt-spiral", "aria-hidden": "true" }, Array.from({ length: 11 }, (_, index) => h("i", { key: index })));
  if (templateId === "cinema-frame") return h("div", { className: "gt-timecode", "aria-hidden": "true" }, `CH ${String(data.chapter || 1).padStart(2, "0")} · 19:07`);
  if (templateId === "neo-brutalist") return h("div", { className: "gt-sticker", "aria-hidden": "true" }, data.bookTitle || "A saved gem");
  return null;
}

export default function TemplateCanvas({ templateId, data, options, effectId, fonts }) {
  const aspect = ASPECT_SIZES[options.aspect] || ASPECT_SIZES["9:16"];
  const quote = String(data.quote || "").trim();
  const palette = options.palette || gemPaletteById(DEFAULT_GEM_PALETTE);
  const fit = fitTemplateQuote(templateId, quote, options.aspect);
  const canShowArtwork = options.supportsPhoto === true && options.showArtwork !== false;
  const backgroundImage = canShowArtwork && data.backgroundImage && !data.imageFailed ? data.backgroundImage : "";
  const photo = backgroundImage && templateId !== "polaroid"
    ? h("img", { className: "gt-background-photo", src: backgroundImage, crossOrigin: "anonymous", alt: "", onError: data.onImageError })
    : null;
  const header = h("header", { className: "gt-header" },
    h("span", { className: "gt-wordmark" }, "READING COMPANION"),
    h("h2", null, data.bookTitle || "A saved gem"),
    data.author && data.author !== "Author unknown" ? h("p", { className: "gt-author" }, data.author) : null);
  const quoteBlock = h("section", { className: "gt-quote-area" },
    h("span", { className: "gt-quote-scrim", "aria-hidden": "true" }),
    templateId === "editorial-paper" ? h("span", { className: "gt-drop-quote", "aria-hidden": "true" }, "“") : null,
    templateId === "neon-terminal" ? h("span", { className: "gt-prompt" }, "> gem_saved") : null,
    h("blockquote", { style: { fontSize: `${fit.fontSize}px`, fontFamily: fonts.quote, color: palette.primaryText } }, quoteNodes(fit.text, templateId)),
    templateId === "neon-terminal" ? h("span", { className: "gt-cursor", "aria-hidden": "true" }) : null,
    templateId === "chalkboard" ? h("span", { className: "gt-hand-rule", "aria-hidden": "true" }) : null,
    templateId === "notebook-highlight" ? h("span", { className: "gt-highlight-swipe", "aria-hidden": "true" }) : null,
    templateId === "zen-ink" ? h("span", { className: "gt-zen-seal", "aria-label": `Reader initials ${initials(data.userInitials)}` }, initials(data.userInitials)) : null);
  const metadata = h("footer", { className: "gt-footer" },
    h("span", { className: "gt-accent-rule" }),
    h("div", { className: "gt-meta" },
      data.chapter ? h("span", null, `CHAPTER ${data.chapter}`) : null,
      h("span", null, "SAVED GEM"),
      data.savedAt ? h("span", null, data.savedAt) : null),
    h("span", { className: "gt-small-wordmark" }, "Reading Companion"));
  const polaroid = templateId === "polaroid"
    ? polaroidFrame(data, backgroundImage ? h("img", { src: backgroundImage, crossOrigin: "anonymous", alt: "", onError: data.onImageError }) : null)
    : null;
  const extraOrnament = ["zen-ink", "notebook-highlight", "cinema-frame", "neo-brutalist"].includes(templateId) ? ornament(templateId, data) : null;
  return h("article", {
    className: `gsc-card gt-card gt-${templateId}${backgroundImage ? " has-photo" : ""}${effectId ? ` effect-${effectId}` : ""}`,
    ref: options.cardRef,
    style: {
      width: `${aspect.width}px`,
      height: `${aspect.height}px`,
      ...gemPaletteStyle(palette),
      "--gt-accent": palette.accent,
    },
    "data-aspect": options.aspect,
  }, photo, polaroid, h("span", { className: "gt-palette-wash", "aria-hidden": "true" }), extraOrnament, header, quoteBlock, metadata);
}