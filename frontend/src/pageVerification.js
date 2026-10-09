export const PAGE_VERIFICATION_KINDS = new Set([
  "book_page",
  "screen_with_book_text",
  "not_a_book_page",
  "unreadable",
]);

export function parsePageVerificationResponse(value) {
  const result = typeof value === "string" ? JSON.parse(value) : value;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("invalid_page_verification");
  }
  const confidence = Number(result.confidence);
  if (!PAGE_VERIFICATION_KINDS.has(result.kind) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("invalid_page_verification");
  }
  const printedPageNumber = result.printedPageNumber === null || result.printedPageNumber === undefined
    ? null
    : Number(result.printedPageNumber);
  if (printedPageNumber !== null && (!Number.isSafeInteger(printedPageNumber) || printedPageNumber < 1)) {
    throw new Error("invalid_page_verification");
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

export function pageVerificationDecision(result) {
  if (result?.kind === "unreadable") return "reject";
  if (result?.kind === "not_a_book_page" && Number(result.confidence) >= 0.6) return "reject";
  if (result?.kind === "book_page" || result?.kind === "screen_with_book_text") return "verified";
  return "unverified";
}

export function rejectedPageMessage(result) {
  const reason = String(result?.reason || "").replace(/[.!?\s]+$/g, "");
  if (reason) return `Ye book ka page nahi lag raha; ${reason.toLocaleLowerCase()}.`;
  if (result?.kind === "unreadable") return "Photo saaf nahi padh pa raha; ek clear photo dobara lijiye.";
  return "Ye book ka page nahi lag raha; dobara sahi page ki photo lijiye.";
}