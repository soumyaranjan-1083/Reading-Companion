import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { GEM_TEMPLATES } from "./index.js";
import { ASPECT_SIZES } from "./aspect.js";
import { fitTemplateQuote } from "./TemplateCanvas.js";
import { contrastRatio, GEM_PALETTES } from "./palettes.js";

const repeatToLength = (value, length) => Array.from({ length }, (_, index) => value[index % value.length]).join("");
const QUOTES = [
  repeatToLength("A short thoughtful quote for a saved gem. ", 20),
  repeatToLength("The quiet courage to begin again can change an ordinary day. ", 140),
  repeatToLength("A reader carries small lights from every page into the rest of life. ", 400),
  "पढ़ना एक नई दुनिया खोलता है 📚✨",
];

test("the template registry exposes 12 unique entries with the complete contract", async () => {
  assert.equal(GEM_TEMPLATES.length, 12);
  assert.equal(new Set(GEM_TEMPLATES.map((template) => template.id)).size, 12);
  assert.deepEqual(Object.keys(ASPECT_SIZES), ["9:16"]);
  for (const template of GEM_TEMPLATES) {
    assert.equal(typeof template.id, "string");
    assert.equal(typeof template.name, "string");
    assert.equal(typeof template.description, "string");
    assert.equal(typeof template.supportsPhoto, "boolean");
    assert.ok(Array.isArray(template.fonts) && template.fonts.length > 0);
    assert.equal(typeof template.defaultAccent, "string");
    assert.equal(typeof template.render, "function");
    assert.equal(typeof template.load, "function");
    const module = await template.load();
    for (const key of ["id", "name", "description", "supportsPhoto", "fonts", "defaultAccent", "render"]) {
      assert.ok(key in module, `${template.id} module exports ${key}`);
    }
    assert.equal(module.id, template.id);
  }
});

test("every template and palette renders legible text in the one 9:16 export format", async () => {
  const image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  for (const template of GEM_TEMPLATES) {
    const module = await template.load();
    for (const palette of GEM_PALETTES) {
      for (const quote of QUOTES) {
        const data = {
          quote,
          bookTitle: "The Book of Small Beginnings",
          author: "A. Reader",
          chapter: 4,
          savedAt: "Oct 10, 2026",
          backgroundImage: image,
          showArtwork: true,
          userInitials: "AR",
        };
        const dimensions = ASPECT_SIZES["9:16"];
        const options = { aspect: "9:16", width: dimensions.width, height: dimensions.height, palette, supportsPhoto: template.supportsPhoto, showArtwork: true, accent: palette.accent, effectId: palette.id };
        const markup = renderToStaticMarkup(module.render(null, data, options));
        assert.match(markup, /data-aspect="9:16"/, `${template.id} ${palette.id}`);
        assert.ok(markup.includes(`width:1080px;height:${dimensions.height}px`), `${template.id} exports at 1080x1920`);
        assert.ok(markup.includes("Reading Companion"), `${template.id} includes a wordmark`);
        assert.ok(markup.includes("The Book of Small Beginnings"), `${template.id} includes book metadata`);
        assert.equal(markup.includes(image), template.supportsPhoto, `${template.id} obeys its artwork design`);
        assert.ok(contrastRatio(palette.primaryText, palette.quoteSurface) >= 4.5, `${template.id}/${palette.id} meets AA contrast`);
        const fit = template.id === "summit"
          ? (await import("./quoteFit.js")).fitQuoteText(quote, { width: 840, height: 660, maxFontSize: 92, minFontSize: 56 })
          : fitTemplateQuote(template.id, quote);
        assert.ok(fit.fontSize >= 56, `${template.id}/${palette.id} keeps quote at least 56px`);
        assert.ok(fit.height <= (template.id === "summit" ? 660 : template.id === "polaroid" ? 576 : 806), `${template.id}/${palette.id} quote fits its region`);
      }
    }
  }
});

test("quote contrast backing is opaque, palette-derived, and not covered by artwork", () => {
  const css = readFileSync(new URL("./templates.css", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("./TemplateCanvas.js", import.meta.url), "utf8");
  assert.match(css, /\.gt-quote-scrim\s*\{[^}]*background:\s*var\(--gt-quote-surface\)/);
  assert.match(css, /\.gt-palette-wash\s*\{[^}]*z-index:\s*1/);
  assert.match(renderer, /className:\s*"gt-quote-scrim"/);
  assert.match(renderer, /const canShowArtwork = options\.supportsPhoto === true/);
});

test("artwork is omitted for no-photo templates and can be hidden for supported templates", async () => {
  for (const template of GEM_TEMPLATES) {
    const module = await template.load();
    const data = { quote: "Short quote", bookTitle: "Book", backgroundImage: "data:image/jpeg;base64,AAAA", showArtwork: false };
    const markup = renderToStaticMarkup(module.render(null, data, { aspect: "9:16", height: 1920, palette: GEM_PALETTES[0], supportsPhoto: template.supportsPhoto, showArtwork: false }));
    assert.doesNotMatch(markup, /data:image\/jpeg/, `${template.id} hides the image when artwork is off`);
  }
});