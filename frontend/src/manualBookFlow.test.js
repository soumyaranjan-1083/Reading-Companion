import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_BOOK_STEPS, mergeManualContents, nextManualBookStep, restoreManualBookDraft } from "./manualBookFlow.js";

test("manual onboarding follows title, author, contents, review, and complete", () => {
  let step = "title";
  const order = [step];
  while (step !== "complete") {
    step = nextManualBookStep(step);
    order.push(step);
  }
  assert.deepEqual(order, MANUAL_BOOK_STEPS);
});

test("contents can skip scanning and continue to the shared review step", () => {
  assert.equal(nextManualBookStep("contents", "skip"), "review");
});

test("manual draft resumes at its saved step but never leaks into another title", () => {
  const raw = JSON.stringify({ step: "contents", title: "Textbook", authorType: "Editor", authorText: "An Editor", chapters: [] });
  assert.deepEqual(restoreManualBookDraft(raw), {
    step: "contents", title: "Textbook", authorType: "Editor", authorText: "An Editor", chapters: [],
  });
  assert.equal(restoreManualBookDraft(raw, "Different book").step, "title");
  assert.equal(restoreManualBookDraft("not JSON").step, "title");
});

test("multi-photo contents merge in order and de-duplicate within a section", () => {
  const merged = mergeManualContents([
    [{ section: "Prose", title: "The Last Leaf", author: "O. Henry", startPage: 11, confidence: "high" }],
    [
      { section: "Prose", title: "The Last Leaf", author: null, startPage: null, confidence: "low" },
      { section: "Poetry", title: "Daffodils", author: "William Wordsworth", startPage: 29, confidence: "medium" },
    ],
  ]);
  assert.deepEqual(merged.map(({ number, section, title, author, startPage, confidence }) => ({ number, section, title, author, startPage, confidence })), [
    { number: 1, section: "Prose", title: "The Last Leaf", author: "O. Henry", startPage: 11, confidence: "low" },
    { number: 2, section: "Poetry", title: "Daffodils", author: "William Wordsworth", startPage: 29, confidence: "medium" },
  ]);
});