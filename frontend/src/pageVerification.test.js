import test from "node:test";
import assert from "node:assert/strict";
import { pageVerificationDecision, parsePageVerificationResponse, rejectedPageMessage } from "./pageVerification.js";

test("page verification response parsing normalizes OCR and page metadata", () => {
  assert.deepEqual(parsePageVerificationResponse({
    kind: "book_page",
    confidence: "0.91",
    printedPageNumber: "42",
    language: "English",
    text: "A visible line.",
    reason: "  Printed   book page. ",
  }), {
    kind: "book_page",
    confidence: 0.91,
    printedPageNumber: 42,
    language: "English",
    text: "A visible line.",
    reason: "Printed book page.",
  });
  assert.throws(() => parsePageVerificationResponse({ kind: "bad_kind", confidence: 0.8 }), /invalid_page_verification/);
});

test("blocking policy rejects unreadable and confident non-book photos only", () => {
  assert.equal(pageVerificationDecision({ kind: "unreadable", confidence: 0.2 }), "reject");
  assert.equal(pageVerificationDecision({ kind: "not_a_book_page", confidence: 0.6 }), "reject");
  assert.equal(pageVerificationDecision({ kind: "not_a_book_page", confidence: 0.59 }), "unverified");
  assert.equal(pageVerificationDecision({ kind: "book_page", confidence: 0.7 }), "verified");
  assert.equal(pageVerificationDecision({ kind: "screen_with_book_text", confidence: 0.7 }), "verified");
  assert.equal(pageVerificationDecision({ kind: "unverified", confidence: 0 }), "unverified");
  assert.match(rejectedPageMessage({ reason: "Laptop screen with SQL editor" }), /book ka page nahi.*laptop screen/i);
});