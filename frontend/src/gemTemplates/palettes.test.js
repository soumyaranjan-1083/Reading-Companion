import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, GEM_PALETTES } from "./palettes.js";

test("eight requested palettes expose complete card tokens and AA quote contrast", () => {
  assert.deepEqual(GEM_PALETTES.map((palette) => palette.name), ["Neon", "Sunset", "Ocean", "Forest", "Mono", "Pastel", "Gold", "Ember"]);
  for (const palette of GEM_PALETTES) {
    assert.equal(palette.stops.length, 3);
    for (const token of ["tint", "accent", "secondaryAccent", "primaryText", "mutedText", "shadow", "quoteSurface"]) assert.ok(palette[token], `${palette.name} has ${token}`);
    assert.ok(contrastRatio(palette.primaryText, palette.quoteSurface) >= 4.5, `${palette.name} quote panel meets WCAG AA`);
  }
});