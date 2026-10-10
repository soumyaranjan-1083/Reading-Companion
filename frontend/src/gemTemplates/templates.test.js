import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GEM_TEMPLATES } from "./index.js";
import { ASPECT_SIZES } from "./aspect.js";

const QUOTES = [
  "Keep going.",
  "The quiet courage to begin again can change the shape of an ordinary day.",
  `${"A reader carries small lights from every page into the rest of life. ".repeat(6)}पढ़ना नई दुनिया खोलता है 📚✨`,
];

test("the template registry exposes 14 unique entries with the complete contract", async () => {
  assert.equal(GEM_TEMPLATES.length, 14);
  assert.equal(new Set(GEM_TEMPLATES.map((template) => template.id)).size, 14);
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

test("every template renders all quote lengths in all three aspect ratios", async () => {
  const image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  for (const template of GEM_TEMPLATES) {
    const module = await template.load();
    for (const [aspect, dimensions] of Object.entries(ASPECT_SIZES)) {
      for (const quote of QUOTES) {
        const data = {
          quote,
          bookTitle: "The Book of Small Beginnings",
          author: "A. Reader",
          chapter: 4,
          savedAt: "Oct 10, 2026",
          backgroundImage: template.supportsPhoto ? image : undefined,
          userInitials: "AR",
        };
        const options = { aspect, width: dimensions.width, height: dimensions.height, accent: template.defaultAccent, effectId: "noir" };
        const markup = renderToStaticMarkup(module.render(null, data, options));
        assert.match(markup, new RegExp(`data-aspect="${aspect.replace(":", "\\:")}"`), `${template.id} ${aspect}`);
        assert.ok(markup.includes(`width:1080px;height:${dimensions.height}px`), `${template.id} exports at 1080px for ${aspect}`);
        assert.ok(markup.includes("Reading Companion"), `${template.id} includes a wordmark`);
        assert.ok(markup.includes("The Book of Small Beginnings"), `${template.id} includes book metadata`);
      }
    }
  }
});