import assert from "node:assert/strict";
import test from "node:test";
import { searchStageAfter } from "./bookSearchStages.js";

test("Search-a-book keeps query, results, editions, review, and save order", () => {
  let stage = "query";
  const sequence = [stage];
  stage = searchStageAfter(stage, "search-complete");
  sequence.push(stage);
  stage = "editions";
  sequence.push(stage);
  stage = searchStageAfter(stage, "edition-has-chapters");
  sequence.push(stage);
  stage = searchStageAfter(stage, "save-complete");
  sequence.push(stage);
  assert.deepEqual(sequence, ["query", "results", "editions", "review", "complete"]);
});

test("Search-a-book without catalogue chapters scans before chapter review", () => {
  assert.equal(searchStageAfter("editions", "edition-needs-scan"), "scan");
  assert.equal(searchStageAfter("scan", "scan-complete"), "review");
});