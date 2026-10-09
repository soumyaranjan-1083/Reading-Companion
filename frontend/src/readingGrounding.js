export function isPlaceholderChapter(chapter) {
  if (!chapter) return false;
  const title = String(chapter.title || "").trim();
  const isDefaultTitle = !title || /^(?:chapter\s+\d+|untitled)$/i.test(title);
  const hasSummary = Boolean(String(chapter.summary || "").trim());
  const hasPages = Number.isFinite(chapter.startPage) || Number.isFinite(chapter.endPage) || (Array.isArray(chapter.pages) && chapter.pages.length > 0);
  const hasVocabulary = Array.isArray(chapter.vocabLog) && chapter.vocabLog.length > 0;
  return isDefaultTitle && !hasSummary && !hasPages && !hasVocabulary;
}

export function buildPlaceholderChapterKnowledgeBlock({ chapterNumber, bookTitle, authorName }) {
  return [
    "KNOWN vs UNKNOWN for this placeholder chapter:",
    `Known: book title ${bookTitle ? `"${bookTitle}"` : "unknown"}; ${authorName ? `saved author ${authorName}; ` : "author not saved; "}chapter number ${chapterNumber}.`,
    "Unknown: the chapter's actual title, content, and pages. Do not summarize, describe, or invent any of them.",
  ].join("\n");
}

export function groundPlaceholderBookContext(bookContext, placeholder, knowledgeBlock) {
  if (!placeholder) return String(bookContext || "");
  const withoutFalseRecap = String(bookContext || "").replace(" This is the first chapter - no recap needed.", "");
  return `${withoutFalseRecap}\n${knowledgeBlock}`;
}