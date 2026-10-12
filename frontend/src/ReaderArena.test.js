import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("weekly zero-minute rows display an em dash rather than an artificial tied rank", () => {
  const arena = readFileSync(new URL("./ReaderArena.jsx", import.meta.url), "utf8");
  const model = readFileSync(new URL("./readerArenaModel.js", import.meta.url), "utf8");
  assert.match(arena, /<span className="arena-row-rank">\{reader\.rank == null \? "—" : `#\$\{reader\.rank\}`\}/);
  assert.match(model, /\.map\(\(reader\) => \(\{ \.\.\.reader, totalSeconds: 0, rank: null \}\)\)/);
  assert.doesNotMatch(arena, /arena-row-rank[^\n]*this week/);
});
