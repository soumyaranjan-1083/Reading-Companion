import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { moveInkGoal, toggleInkSwitch } from "./inkMotion.js";

test("shared switches expose a labelled switch and dispatch the inverse value", () => {
  const primitives = readFileSync(new URL("./InkPrimitives.jsx", import.meta.url), "utf8");
  assert.match(primitives, /role="switch" aria-checked=\{checked\} aria-label=\{label\}/);
  let nextValue = null;
  toggleInkSwitch(false, (value) => { nextValue = value; }, () => {});
  assert.equal(nextValue, true);
});

test("goal dial exposes four labelled radio detents and arrow-key selection", () => {
  const primitives = readFileSync(new URL("./InkPrimitives.jsx", import.meta.url), "utf8");
  assert.match(primitives, /role="radiogroup" aria-label=\{label\}/);
  assert.match(primitives, /role="radio" aria-checked=\{selected === index\}/);
  const options = ["10 min", "20 min", "30 min", "1 hour"];
  assert.equal(moveInkGoal("20 min", options, 1), "30 min");
  assert.equal(moveInkGoal("10 min", options, -1), "1 hour");
});

test("gallery is reachable only through a development query and loads its icons, cards, and control primitives", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const gallery = readFileSync(new URL("./InkGallery.jsx", import.meta.url), "utf8");
  assert.match(app, /import\.meta\.env\.DEV && new URLSearchParams\(window\.location\.search\)\.get\("ui-v3-gallery"\)/);
  assert.match(gallery, /const ICONS = \[/);
  assert.match(gallery, /InkHoldConfirmButton/);
  assert.match(gallery, /light-theme/);
  assert.match(gallery, /dark-theme/);
});
