import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaceholderChapterKnowledgeBlock, groundPlaceholderBookContext, isPlaceholderChapter } from "./readingGrounding.js";

test("empty default chapter is detected as a placeholder", () => {
  assert.equal(isPlaceholderChapter({ title: "Chapter 1", summary: "", startPage: null, endPage: null, vocabLog: [] }), true);
  assert.equal(isPlaceholderChapter({ title: "", summary: "", vocabLog: [] }), true);
  assert.equal(isPlaceholderChapter({ title: "Chapter 1", summary: "A saved summary.", vocabLog: [] }), false);
  assert.equal(isPlaceholderChapter({ title: "Chapter 1", startPage: 4, summary: "", vocabLog: [] }), false);
  assert.equal(isPlaceholderChapter({ title: "Chapter 1", summary: "", vocabLog: [{ term: "word" }] }), false);
});

test("placeholder chapter knowledge is explicitly limited to known metadata", () => {
  const context = buildPlaceholderChapterKnowledgeBlock({ chapterNumber: 1, bookTitle: "Living Untethered", authorName: "Michael A. Singer" });
  assert.match(context, /KNOWN vs UNKNOWN/);
  assert.match(context, /chapter number 1/);
  assert.match(context, /actual title, content, and pages/);
  assert.doesNotMatch(context, /no recap needed/i);
});

test("grounded buildLiveContext output removes the false first-chapter recap", () => {
  const knowledge = buildPlaceholderChapterKnowledgeBlock({ chapterNumber: 1, bookTitle: "Living Untethered" });
  const context = groundPlaceholderBookContext("Book: Living Untethered. This is the first chapter - no recap needed.", true, knowledge);
  assert.doesNotMatch(context, /no recap needed/i);
  assert.match(context, /KNOWN vs UNKNOWN/);
  assert.match(groundPlaceholderBookContext("ordinary context", false, knowledge), /ordinary context/);
});