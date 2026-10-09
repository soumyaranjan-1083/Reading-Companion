import test from "node:test";
import assert from "node:assert/strict";
import { parsePageVerification } from "./pageVerification.js";

test("page verification parses bounded, valid model output", () => {
  assert.deepEqual(parsePageVerification(JSON.stringify({
    kind: "screen_with_book_text",
    confidence: 0.94,
    printedPageNumber: "12",
    language: "English",
    text: "Visible sentence.",
    reason: "An e-reader page with book prose.",
  })), {
    kind: "screen_with_book_text",
    confidence: 0.94,
    printedPageNumber: 12,
    language: "English",
    text: "Visible sentence.",
    reason: "An e-reader page with book prose.",
  });
});

test("page verification rejects malformed values", () => {
  assert.throws(() => parsePageVerification("not json"));
  assert.throws(() => parsePageVerification(JSON.stringify({ kind: "maybe", confidence: 0.8 })));
  assert.throws(() => parsePageVerification(JSON.stringify({ kind: "book_page", confidence: 1.2 })));
  assert.throws(() => parsePageVerification(JSON.stringify({ kind: "book_page", confidence: 0.8, printedPageNumber: 0 })));
});