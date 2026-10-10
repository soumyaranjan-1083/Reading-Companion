export const MANUAL_BOOK_STEPS = ["title", "author", "contents", "review", "complete"];

export function nextManualBookStep(step, action = "continue") {
  if (step === "title") return "author";
  if (step === "author") return "contents";
  if (step === "contents") return action === "skip" ? "review" : "review";
  if (step === "review") return "complete";
  return step;
}

export function restoreManualBookDraft(raw, initialTitle = "") {
  let draft;
  try { draft = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { draft = null; }
  const requested = String(initialTitle || "").trim().toLocaleLowerCase();
  const saved = String(draft?.title || "").trim().toLocaleLowerCase();
  if (!draft || !saved || (requested && requested !== saved) || !MANUAL_BOOK_STEPS.includes(draft.step)) {
    return { step: "title", title: String(initialTitle || ""), authorType: "Author", authorText: "", chapters: [] };
  }
  return {
    step: draft.step,
    title: String(draft.title).slice(0, 200),
    authorType: ["Author", "Editor", "Publisher", "Multiple authors"].includes(draft.authorType) ? draft.authorType : "Author",
    authorText: String(draft.authorText || "").slice(0, 160),
    chapters: Array.isArray(draft.chapters) ? draft.chapters.slice(0, 200) : [],
  };
}

export function mergeManualContents(results) {
  const merged = [];
  const seen = new Map();
  for (const chapters of results || []) {
    for (const chapter of Array.isArray(chapters) ? chapters : []) {
      const title = String(chapter?.title || "").trim();
      if (!title) continue;
      const section = String(chapter.section || "").trim();
      const key = `${section.toLocaleLowerCase()}\u0000${title.toLocaleLowerCase()}`;
      const existingIndex = seen.get(key);
      if (existingIndex !== undefined) {
        const existing = merged[existingIndex];
        if (existing.startPage == null && Number.isInteger(chapter.startPage)) existing.startPage = chapter.startPage;
        if (!existing.author && chapter.author) existing.author = chapter.author;
        if (chapter.confidence === "low") existing.confidence = "low";
        continue;
      }
      seen.set(key, merged.length);
      merged.push({
        section: section || null,
        title,
        author: chapter.author || null,
        startPage: Number.isInteger(chapter.startPage) ? chapter.startPage : null,
        confidence: ["high", "medium", "low"].includes(chapter.confidence) ? chapter.confidence : "low",
      });
    }
  }
  return merged.map((chapter, index) => ({ ...chapter, number: index + 1 }));
}