import { dispatchLocalDataChanged } from "./accountSync.js";

const STORAGE_KEY = "reading_companion_gems";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted data - start fresh
  }
  return [];
}

function summarizeQuote(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "A meaningful takeaway from this book.";
  return clean.length > 120 ? `${clean.slice(0, 117).trim()}…` : clean;
}

function toStepArray(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function flattenTakeaway({ takeawaySituation, takeawaySteps, takeawayExample, takeawayWhyItMatters, legacyTakeaway }) {
  const parts = [];
  if (takeawaySituation) parts.push(takeawaySituation);
  if (takeawaySteps?.length) parts.push(takeawaySteps.map((s, i) => `${i + 1}) ${s}`).join("\n"));
  if (takeawayExample) parts.push(`Example: ${takeawayExample}`);
  if (takeawayWhyItMatters) parts.push(takeawayWhyItMatters);
  if (parts.length) return parts.join("\n");
  return legacyTakeaway || "";
}

function normalizeGem(raw) {
  const takeawaySituation = String(raw.takeawaySituation || "").trim();
  const takeawaySteps = toStepArray(raw.takeawaySteps);
  const takeawayExample = String(raw.takeawayExample || "").trim();
  const takeawayWhyItMatters = String(raw.takeawayWhyItMatters || "").trim();
  const legacyTakeaway = raw.takeaway ?? raw.application ?? "";
  const flatTakeaway = flattenTakeaway({ takeawaySituation, takeawaySteps, takeawayExample, takeawayWhyItMatters, legacyTakeaway });

  const quote = raw.quote || "";
  const authorName = raw.authorName || raw.attributedTo || "";
  const chapterNumber = raw.chapterNumber ?? raw.chapter ?? null;
  return {
    id: raw.id || `gem-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookId: raw.bookId || null,
    quote,
    takeawaySituation,
    takeawaySteps,
    takeawayExample,
    takeawayWhyItMatters,
    takeaway: flatTakeaway,
    application: flatTakeaway,
    bookTitle: raw.bookTitle || "",
    chapter: chapterNumber,
    chapterNumber,
    createdAt: raw.createdAt || new Date().toISOString(),
    sketch: raw.sketch ?? null,
    sketchStyle: raw.sketchStyle || null,
    summary: raw.summary || summarizeQuote(quote),
    quoteSource: raw.quoteSource || "",
    attributedTo: raw.attributedTo || authorName || "",
    authorName,
    themes: Array.isArray(raw.themes) ? raw.themes.map((theme) => String(theme).toLowerCase().trim()).filter(Boolean).slice(0, 4) : [],
    coreIdea: typeof raw.coreIdea === "string" ? raw.coreIdea : "",
    embedding: Array.isArray(raw.embedding) && raw.embedding.every(Number.isFinite) ? raw.embedding : null,
    insightHash: typeof raw.insightHash === "string" ? raw.insightHash : "",
  };
}

function createGemId(gems) {
  let id = "";
  do {
    id = `gem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } while (gems.some((gem) => String(gem.id) === id));
  return id;
}

export class Gems {
  constructor() {
    this.gems = load().map(normalizeGem);
  }
    _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.gems));
    } catch (e) {
      console.warn("[GEMS] save failed (storage full?)", e);
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("gems:updated"));
    dispatchLocalDataChanged();
  }
  add({
    quote, takeawaySituation, takeawaySteps, takeawayExample, takeawayWhyItMatters,
    takeaway, application, bookTitle, bookId, chapter, chapterNumber, summary,
    quoteSource, attributedTo, authorName,
  }) {
    const cleanQuote = (quote || "").trim();
    if (!cleanQuote) return false;
    const resolvedAuthor = attributedTo || authorName || "";
    const resolvedChapterNumber = chapterNumber ?? chapter ?? null;
    const saved = normalizeGem({
      id: createGemId(this.gems),
      quote: cleanQuote,
      takeawaySituation,
      takeawaySteps,
      takeawayExample,
      takeawayWhyItMatters,
      takeaway: takeaway || application || "",
      bookTitle: bookTitle || "",
      bookId: bookId || null,
      chapter: resolvedChapterNumber,
      chapterNumber: resolvedChapterNumber,
      createdAt: new Date().toISOString(),
      sketch: null, // no auto-generation - user picks a style manually
      summary: summary || summarizeQuote(cleanQuote),
      quoteSource: quoteSource || "",
      attributedTo: resolvedAuthor,
      authorName: resolvedAuthor,
    });
    this.gems.unshift(saved);
    this._save();
    return saved;
  }
  getById(id) {
    return this.gems.find((g) => g.id === id) || null;
  }
  updateInsight(id, insight) {
    const gem = this.getById(id);
    if (!gem || !insight || typeof insight !== "object") return false;
    gem.themes = Array.isArray(insight.themes) ? insight.themes.map((theme) => String(theme).toLowerCase().trim()).filter(Boolean).slice(0, 4) : [];
    gem.coreIdea = typeof insight.coreIdea === "string" ? insight.coreIdea.slice(0, 260) : "";
    gem.embedding = Array.isArray(insight.embedding) && insight.embedding.every(Number.isFinite) ? insight.embedding : null;
    gem.insightHash = typeof insight.insightHash === "string" ? insight.insightHash : "";
    this._save();
    return true;
  }
  remove(id) {
    const idx = this.gems.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    this.gems.splice(idx, 1);
    this._save();
    return true;
  }
  removeForBook(bookId) {
    const removed = this.gems.filter((gem) => gem.bookId === bookId);
    if (!removed.length) return [];
    this.gems = this.gems.filter((gem) => gem.bookId !== bookId);
    this._save();
    return removed.map(normalizeGem);
  }
  restoreMany(items) {
    if (!Array.isArray(items) || !items.length) return 0;
    const existing = new Set(this.gems.map((gem) => String(gem.id)));
    const restored = items.map(normalizeGem).filter((gem) => !existing.has(String(gem.id)));
    this.gems.unshift(...restored);
    if (restored.length) this._save();
    return restored.length;
  }
  setSketchStyle(id, style) {
    const gem = this.getById(id);
    if (!gem) return false;
    gem.sketchStyle = style;
    this._save();
    return true;
  }
  markSketchPending(id) {
    const gem = this.getById(id);
    if (!gem) return false;
    gem.sketch = "pending";
    this._save();
    return true;
  }
  setSketchSuccess(id, dataUrl) {
    const gem = this.getById(id);
    if (!gem) return false;
    gem.sketch = { dataUrl, generatedAt: new Date().toISOString() };
    this._save();
    return true;
  }
  setSketchFailed(id) {
    const gem = this.getById(id);
    if (!gem) return false;
    gem.sketch = "failed";
    this._save();
    return true;
  }
  list() {
    return this.gems.map(normalizeGem);
  }
}