import assert from "node:assert/strict";
import test from "node:test";
import { fitQuoteText } from "./quoteFit.js";

test("short quotes retain the requested display size", () => {
  const fit = fitQuoteText("Keep going.", { width: 720, height: 560, maxFontSize: 92 });
  assert.equal(fit.fontSize, 92);
  assert.ok(fit.height <= 560);
});

test("long quotes shrink and wrap without losing characters", () => {
  const quote = "A thoughtful sentence about reading can grow into a long reflection. ".repeat(7);
  const fit = fitQuoteText(quote, { width: 520, height: 450, maxFontSize: 82, minFontSize: 20 });
  assert.ok(fit.fontSize < 82);
  assert.ok(fit.height <= 450);
  assert.equal(fit.lines.join(" "), quote.trim());
});

test("manual line breaks and long unbroken tokens fit", () => {
  const fit = fitQuoteText("First line\nSecondLineThatHasNoSpaces0123456789", { width: 180, height: 240, maxFontSize: 44, minFontSize: 16 });
  assert.ok(fit.lines.length > 2);
  assert.ok(fit.height <= 240);
  assert.equal(fit.lines.join("").replace(/\s/gu, ""), "FirstlineSecondLineThatHasNoSpaces0123456789");
});

test("Devanagari combining marks and emoji are wrapped as graphemes", () => {
  const quote = "पढ़ना एक नई दुनिया खोलता है 📚✨ " .repeat(5);
  const fit = fitQuoteText(quote, { width: 260, height: 300, maxFontSize: 48, minFontSize: 16 });
  assert.ok(fit.lines.length > 1);
  assert.ok(fit.height <= 300);
  assert.equal(fit.lines.join(" "), quote.trim());
});

test("very long quotes stay at least 56px and ellipsize within the available card region", () => {
  const quote = "A thoughtful reader can carry a sentence into a completely different day. ".repeat(8);
  const fit = fitQuoteText(quote, { width: 700, height: 280, maxFontSize: 82, minFontSize: 56 });
  assert.ok(fit.fontSize >= 56);
  assert.ok(fit.height <= 280);
  assert.equal(fit.truncated, true);
  assert.ok(fit.text.endsWith("…"));
  assert.notEqual(fit.lines.join(" "), quote.trim());
});