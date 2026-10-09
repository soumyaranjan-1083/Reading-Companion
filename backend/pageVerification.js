const PAGE_KINDS = new Set(["book_page", "screen_with_book_text", "not_a_book_page", "unreadable"]);

export function parsePageVerification(text) {
  const result = JSON.parse(String(text || ""));
  const confidence = Number(result?.confidence);
  const printedPageNumber = result?.printedPageNumber === null || result?.printedPageNumber === undefined
    ? null
    : Number(result.printedPageNumber);
  if (!result || !PAGE_KINDS.has(result.kind) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
      (printedPageNumber !== null && (!Number.isSafeInteger(printedPageNumber) || printedPageNumber < 1))) {
    throw new Error("invalid_page_verification_response");
  }
  return {
    kind: result.kind,
    confidence,
    printedPageNumber,
    language: String(result.language || "unknown").slice(0, 40),
    text: String(result.text || "").slice(0, 12000),
    reason: String(result.reason || "").replace(/\s+/g, " ").trim().slice(0, 180),
  };
}