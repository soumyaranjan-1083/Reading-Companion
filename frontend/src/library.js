import { dispatchLocalDataChanged } from "./accountSync.js";

const STORAGE_KEY = "reading_companion_library";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted data - start fresh
  }

  return { books: {} };
}

function inferChapterEndPages(chapters) {
  const ordered = Object.values(chapters).sort((a, b) => a.number - b.number);
  if (ordered.length) delete ordered.at(-1).endPage;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (Number.isFinite(current.startPage) && Number.isFinite(next.startPage) && next.startPage > current.startPage) {
      current.endPage = next.startPage - 1;
    }
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "book";
}

function emptyChapter(number) {
  return {
    number,
    title: `Chapter ${number}`,
    section: null,
    author: null,
    confidence: null,
    summary: "",
    status: "",
    vocabLog: [],
    jumpNote: null,
    startPage: null,
    endPage: null,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

function normalizeVocabularyEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const toList = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
    return [];
  };

  const contextMeaning = String(
    entry.contextMeaning ||
    entry.contextualMeaning ||
    entry.dictionaryMeaning ||
    entry.definition ||
    entry.englishMeaning ||
    entry.meaning ||
    ""
  ).trim();

  const dictionaryMeaning = String(entry.meaning || entry.contextMeaning || entry.contextualMeaning || entry.dictionaryMeaning || entry.definition || entry.englishMeaning || "").trim();

  return {
    term: String(entry.term || "").trim(),
    meaning: dictionaryMeaning,
    contextMeaning,
    example: String(entry.example || entry.usage || "").trim(),
    grammar: String(entry.grammar || entry.partOfSpeech || entry.part_of_speech || entry.pos || "").trim(),
    pronunciation: String(entry.pronunciation || entry.phonetic || "").trim(),
    synonyms: toList(entry.synonyms || entry.synonym),
    antonyms: toList(entry.antonyms || entry.antonym),
    hindiMeaning: String(entry.hindiMeaning || entry.hindi || "").trim(),
    odiaMeaning: String(entry.odiaMeaning || entry.odia || "").trim(),
    hindiSentence: String(entry.hindiSentence || "").trim(),
    odiaSentence: String(entry.odiaSentence || "").trim(),
    sentence: String(entry.sentence || entry.context || entry.bookSentence || "").trim(),
    timestamp: entry.timestamp || new Date().toISOString(),
    usageRegister: ["everyday", "formal-literary", "uncertain"].includes(entry.usageRegister) ? entry.usageRegister : "uncertain",
    practiceCount: Math.max(0, Number(entry.practiceCount) || 0),
    practicedAt: entry.practicedAt || null,
    recallAttempts: Math.max(0, Number(entry.recallAttempts) || 0),
    recallSuccesses: Math.max(0, Number(entry.recallSuccesses) || 0),
    lastRecallAt: entry.lastRecallAt || null,
    pronunciationHints: Array.isArray(entry.pronunciationHints) ? entry.pronunciationHints
      .filter((hint) => hint && typeof hint.observed === "string")
      .slice(-4)
      .map((hint) => ({ observed: hint.observed.slice(0, 80), count: Math.max(1, Number(hint.count) || 1), lastAt: hint.lastAt || null })) : [],
  };
}

function normalize(book) {
  const hasChapters = book.chapters && typeof book.chapters === "object" && Object.keys(book.chapters).length > 0;
  let chapters = hasChapters ? book.chapters : {};
  if (!hasChapters && (book.plotSummary || (Array.isArray(book.vocabLog) && book.vocabLog.length))) {
    chapters = {
      1: {
        ...emptyChapter(1),
        summary: book.plotSummary || "",
        vocabLog: Array.isArray(book.vocabLog) ? book.vocabLog : [],
        startedAt: book.startedAt || new Date().toISOString(),
        lastActiveAt: book.lastReadAt || new Date().toISOString(),
      },
    };
  }
  if (Object.keys(chapters).length === 0) chapters = { 1: emptyChapter(1) };
  // Backfill any missing fields on older chapter records so nothing crashes.
  for (const key of Object.keys(chapters)) {
    chapters[key] = { ...emptyChapter(Number(key)), ...chapters[key] };
    chapters[key].vocabLog = Array.isArray(chapters[key].vocabLog)
      ? chapters[key].vocabLog.map(normalizeVocabularyEntry).filter(Boolean)
      : [];
  }

  const chapterNumbers = Object.keys(chapters).map(Number);
  return {
    id: book.id,
    title: book.title || "Untitled",
    displayTitle: book.displayTitle || book.title || "Untitled",
    deletedAt: book.deletedAt || null,
    archivedRelated: book.archivedRelated || null,
    tileColorIndex: Number.isInteger(book.tileColorIndex) && book.tileColorIndex >= 0 ? book.tileColorIndex : null,
    coverImage: book.coverImage || "",
    coverUrl: book.coverUrl || "",
    isbn: book.isbn || "",
    authorName: book.authorName || "",
    authorType: ["Author", "Editor", "Publisher", "Multiple authors"].includes(book.authorType) ? book.authorType : "Author",
    authorBio: book.authorBio || "",
    authorPortrait: book.authorPortrait || "",
    authorPortraits: Array.isArray(book.authorPortraits) ? book.authorPortraits : [],
    sessions: Array.isArray(book.sessions) ? book.sessions.slice(-30) : [],
    startedAt: book.startedAt || new Date().toISOString(),
    lastReadAt: book.lastReadAt || book.startedAt || new Date().toISOString(),
    sessionCount: typeof book.sessionCount === "number" ? book.sessionCount : 0,
    currentChapterNumber: book.currentChapterNumber || Math.max(...chapterNumbers, 1),
    chapters,
  };
}

export class Library {
  constructor() {
    this.data = load();
  }
   _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("[LIBRARY] save failed (storage full?)", e);
    }
    dispatchLocalDataChanged();
  }

  listBooks() {
    this.ensureTileColors();
    return Object.values(this.data.books).filter((book) => !book.deletedAt).map(normalize).sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));
  }
  listDeletedBooks() {
    return Object.values(this.data.books).filter((book) => book.deletedAt).map(normalize).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }
  getBook(id) {
    const raw = this.data.books[id];
    return raw ? normalize(raw) : null;
  }
  ensureTileColors() {
    const used = new Set();
    const seen = new Set();
    for (const raw of Object.values(this.data.books)) {
      if (!Number.isInteger(raw.tileColorIndex) || raw.tileColorIndex < 0 || seen.has(raw.tileColorIndex)) {
        raw.tileColorIndex = null;
        continue;
      }
      seen.add(raw.tileColorIndex);
      used.add(raw.tileColorIndex);
    }
    let next = 0;
    let changed = false;
    for (const raw of Object.values(this.data.books)) {
      if (Number.isInteger(raw.tileColorIndex) && raw.tileColorIndex >= 0) continue;
      while (used.has(next)) next += 1;
      raw.tileColorIndex = next;
      used.add(next);
      next += 1;
      changed = true;
    }
    if (changed) this._save();
  }
  getOrCreateBook(title) {
    const clean = title.trim() || "Untitled";
    const existing = Object.values(this.data.books).find((b) => !b.deletedAt && b.title.toLowerCase() === clean.toLowerCase());
    if (existing) return normalize(existing);
    this.ensureTileColors();
    const used = new Set(Object.values(this.data.books).map((book) => book.tileColorIndex));
    let tileColorIndex = 0;
    while (used.has(tileColorIndex)) tileColorIndex += 1;
    let id = `${slugify(clean)}-${Date.now()}`;
    while (this.data.books[id]) id = `${slugify(clean)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const book = normalize({ id, title: clean, tileColorIndex });
    this.data.books[id] = book;
    this._save();
    return book;
  }
  updateBookMeta(id, { displayTitle, coverImage, coverUrl, isbn, authorName, authorType, authorBio, authorPortrait, authorPortraits } = {}) {
    const raw = this.data.books[id];
    if (!raw) return;
    const book = normalize(raw);
    if (typeof displayTitle === "string" && displayTitle.trim()) book.displayTitle = displayTitle.trim();
    if (typeof coverImage === "string") book.coverImage = coverImage;
    if (typeof coverUrl === "string") book.coverUrl = coverUrl;
    if (typeof isbn === "string") book.isbn = isbn.trim();
    if (typeof authorName === "string") book.authorName = authorName.trim();
    if (["Author", "Editor", "Publisher", "Multiple authors"].includes(authorType)) book.authorType = authorType;
    if (typeof authorBio === "string") book.authorBio = authorBio.trim();
    if (typeof authorPortrait === "string") book.authorPortrait = authorPortrait;
    if (Array.isArray(authorPortraits)) book.authorPortraits = authorPortraits;
    this.data.books[id] = book;
    this._save();
  }
  deleteBook(id, archivedRelated = {}) {
    const book = this.data.books[id];
    if (!book || book.deletedAt) return false;
    book.deletedAt = new Date().toISOString();
    book.archivedRelated = archivedRelated;
    this._save();
    return true;
  }
  restoreBook(id) {
    const book = this.data.books[id];
    if (!book?.deletedAt) return null;
    const archivedRelated = book.archivedRelated || {};
    delete book.deletedAt;
    delete book.archivedRelated;
    this._save();
    return archivedRelated;
  }
  permanentlyDeleteBook(id) {
    if (!this.data.books[id]?.deletedAt) return false;
    delete this.data.books[id];
    this._save();
    return true;
  }
  deleteChapter(id, chapterNumber) {
    const raw = this.data.books[id];
    const number = Number(chapterNumber);
    if (!raw || !Number.isInteger(number) || number < 1 || !raw.chapters?.[number]) return { ok: false, reason: "not_found" };
    const book = normalize(raw);
    const existing = Object.keys(book.chapters).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (existing.length <= 1) return { ok: false, reason: "last_chapter" };
    delete book.chapters[number];
    const remaining = Object.keys(book.chapters).map(Number).filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
    if (book.currentChapterNumber === number) book.currentChapterNumber = remaining.filter((n) => n < number).at(-1) || remaining[0] || 1;
    this.data.books[id] = book;
    this._save();
    return { ok: true, currentChapterNumber: book.currentChapterNumber };
  }
  touch(id) {
    const book = this.data.books[id];
    if (!book) return;
    book.lastReadAt = new Date().toISOString();
    book.sessionCount = (book.sessionCount || 0) + 1;
    this._save();
  }
  getChapters(id) {
    const book = this.getBook(id);
    if (!book) return [];
    const real = Object.values(book.chapters).sort((a, b) => a.number - b.number);
    const maxNum = Math.max(...real.map((c) => c.number), 1);
    const filled = [];
    for (let n = 1; n <= maxNum; n++) {
      const existing = book.chapters[n];
      filled.push(existing || { number: n, title: `Chapter ${n}`, vocabLog: [], summary: "", isPlaceholder: true });
    }
    return filled;
  }
  getChapter(id, chapterNumber) {
    const book = this.getBook(id);
    return book?.chapters?.[chapterNumber] || null;
  }
  renameChapter(id, chapterNumber, title) {
    const raw = this.data.books[id];
    if (!raw || !title?.trim()) return;
    const book = normalize(raw);
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    book.chapters[chapterNumber].title = title.trim();
    this.data.books[id] = book;
    this._save();
  }
  setChapterPages(id, chapterNumber, startPage, endPage) {
    const raw = this.data.books[id];
    if (!raw) return;
    const book = normalize(raw);
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    const chapter = book.chapters[chapterNumber];
    if (Number.isFinite(startPage)) chapter.startPage = startPage;
    if (Number.isFinite(endPage)) chapter.endPage = endPage;
    inferChapterEndPages(book.chapters);
    chapter.lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
  }
  setCurrentChapter(id, chapterNumber, justification, title) {
    const raw = this.data.books[id];
    if (!raw) return { ok: false };
    const book = normalize(raw);
    const isJump = chapterNumber > book.currentChapterNumber + 1;
    if (isJump && !justification) return { ok: false, needsJustification: true };
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    if (justification) book.chapters[chapterNumber].jumpNote = justification;
    if (title && title.trim()) book.chapters[chapterNumber].title = title.trim();

    Object.keys(book.chapters).forEach((key) => {
      const n = Number(key);
      const chapter = book.chapters[n];
      if (!chapter) return;
      if (n < chapterNumber && !["closed", "completed", "done", "finished"].includes(String(chapter.status || "").trim().toLowerCase())) {
        chapter.status = "inprogress";
      }
    });

    book.chapters[chapterNumber].status = "inprogress";
    book.chapters[chapterNumber].lastActiveAt = new Date().toISOString();
    book.currentChapterNumber = chapterNumber;
    this.data.books[id] = book;
    this._save();
    return { ok: true };
  }
  addVocab(id, chapterNumber, entry) {
    const raw = this.data.books[id];
    const normalizedEntry = normalizeVocabularyEntry(entry);
    if (!raw || !normalizedEntry || !normalizedEntry.term || !normalizedEntry.meaning) return false;
    const book = normalize(raw);
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    const chapter = book.chapters[chapterNumber];
    const dup = chapter.vocabLog.some((v) => String(v.term || "").toLowerCase() === normalizedEntry.term.toLowerCase());
    if (dup) return false;
    chapter.vocabLog.push(normalizedEntry);
    chapter.lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
    return true;
  }
  removeVocab(id, term, chapterNumber) {
    const raw = this.data.books[id];
    if (!raw || !term) return false;
    const book = normalize(raw);
    const needle = String(term).trim().toLowerCase();
    const scope = Number.isFinite(chapterNumber) && book.chapters[chapterNumber] ? [book.chapters[chapterNumber]] : Object.values(book.chapters);
    for (const ch of scope) {
      const idx = (ch.vocabLog || []).findIndex((v) => String(v.term || "").trim().toLowerCase() === needle);
      if (idx >= 0) {
        ch.vocabLog.splice(idx, 1);
        ch.lastActiveAt = new Date().toISOString();
        this.data.books[id] = book;
        this._save();
        return true;
      }
    }
    return false;
  }
  deleteVocab(id, chapterNumber, term) {
    const raw = this.data.books[id];
    const number = Number(chapterNumber);
    const cleanTerm = String(term || "").trim().toLowerCase();
    if (!raw || !Number.isInteger(number) || !cleanTerm) return false;
    const book = normalize(raw);
    const chapter = book.chapters[number];
    if (!chapter || !Array.isArray(chapter.vocabLog)) return false;
    const index = chapter.vocabLog.findIndex((entry) => String(entry.term || "").trim().toLowerCase() === cleanTerm);
    if (index < 0) return false;
    chapter.vocabLog.splice(index, 1);
    chapter.lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
    return true;
  }
  updateVocabularyEntry(id, chapterNumber, term, updates) {
    const raw = this.data.books[id];
    if (!raw || !Number.isInteger(Number(chapterNumber))) return false;
    const book = normalize(raw);
    const chapter = book.chapters[Number(chapterNumber)];
    const entry = chapter?.vocabLog?.find((v) => String(v.term || "").toLowerCase() === String(term || "").toLowerCase());
    if (!entry) return false;
    Object.assign(entry, updates);
    this.data.books[id] = book;
    this._save();
    return true;
  }
  markVocabularyPracticed(id, chapterNumber, term) {
    const chapter = this.getChapter(id, chapterNumber);
    const entry = chapter?.vocabLog?.find((v) => String(v.term || "").toLowerCase() === String(term || "").toLowerCase());
    if (!entry) return false;
    return this.updateVocabularyEntry(id, chapterNumber, term, {
      practiceCount: (Number(entry.practiceCount) || 0) + 1,
      practicedAt: new Date().toISOString(),
    });
  }
  markVocabularyRecall(id, chapterNumber, term, remembered = false) {
    const chapter = this.getChapter(id, chapterNumber);
    const entry = chapter?.vocabLog?.find((v) => String(v.term || "").toLowerCase() === String(term || "").toLowerCase());
    if (!entry) return false;
    return this.updateVocabularyEntry(id, chapterNumber, term, {
      recallAttempts: (Number(entry.recallAttempts) || 0) + 1,
      recallSuccesses: (Number(entry.recallSuccesses) || 0) + (remembered ? 1 : 0),
      lastRecallAt: new Date().toISOString(),
    });
  }
  recordVocabularyPronunciation(id, chapterNumber, term, observed) {
    const chapter = this.getChapter(id, chapterNumber);
    const entry = chapter?.vocabLog?.find((v) => String(v.term || "").toLowerCase() === String(term || "").toLowerCase());
    const spoken = String(observed || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!entry || !spoken || spoken.toLowerCase() === String(term).toLowerCase()) return false;
    const hints = Array.isArray(entry.pronunciationHints) ? [...entry.pronunciationHints] : [];
    const key = spoken.toLowerCase();
    const existing = hints.find((hint) => hint.observed.toLowerCase() === key);
    if (existing) {
      existing.count += 1;
      existing.lastAt = new Date().toISOString();
    } else {
      hints.push({ observed: spoken, count: 1, lastAt: new Date().toISOString() });
    }
    return this.updateVocabularyEntry(id, chapterNumber, term, { pronunciationHints: hints.slice(-4) });
  }
  updateChapterSummary(id, chapterNumber, summary) {
    const raw = this.data.books[id];
    if (!raw || !summary) return;
    const book = normalize(raw);
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    book.chapters[chapterNumber].summary = summary;
    book.chapters[chapterNumber].lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
  }
  setChapterOutline(id, list) {
    const raw = this.data.books[id];
    if (!raw || !Array.isArray(list)) return 0;
    const book = normalize(raw);
    let count = 0;
    for (const item of list) {
      const n = Number(item?.chapterNumber);
      if (!Number.isFinite(n) || n < 1 || n > 500) continue;
      if (!book.chapters[n]) book.chapters[n] = emptyChapter(n);
      const ch = book.chapters[n];
      if (typeof item.title === "string" && item.title.trim()) ch.title = item.title.trim();
      if (typeof item.section === "string" || item.section === null) ch.section = item.section?.trim() || null;
      if (typeof item.author === "string" || item.author === null) ch.author = item.author?.trim() || null;
      if (["high", "medium", "low"].includes(item.confidence)) ch.confidence = item.confidence;
      const s = Number(item.startPage), e = Number(item.endPage);
      if (Number.isFinite(s) && s > 0) ch.startPage = s;
      if (Number.isFinite(e) && e > 0 && (!Number.isFinite(s) || e >= s)) ch.endPage = e;
      count += 1;
    }
    inferChapterEndPages(book.chapters);
    this.data.books[id] = book;
    this._save();
    return count;
  }
  completeChapter(id, chapterNumber, justification) {
    const raw = this.data.books[id];
    if (!raw) return { ok: false };
    const book = normalize(raw);
    const ch = book.chapters[chapterNumber];
    if (!ch) return { ok: false };
    const thin = !ch.summary || ch.summary.trim().length < 150;
    const note = String(justification || "").trim();
    if (thin && !note) return { ok: false, needsJustification: true };
    ch.status = "completed";
    if (note) ch.completionNote = note;
    ch.lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
    return { ok: true, early: thin };
  }
  setChapterStatus(id, chapterNumber, status) {
    const raw = this.data.books[id];
    if (!raw) return;
    const book = normalize(raw);
    if (!book.chapters[chapterNumber]) book.chapters[chapterNumber] = emptyChapter(chapterNumber);
    const next = typeof status === "string" ? status.trim() : "";
    book.chapters[chapterNumber].status = next;
    book.chapters[chapterNumber].lastActiveAt = new Date().toISOString();
    this.data.books[id] = book;
    this._save();
  }

  _wordCount(book) { return Object.values(book.chapters).reduce((s, c) => s + (c.vocabLog?.length || 0), 0); }
  startSession(id) {
    const raw = this.data.books[id];
    if (!raw) return;
    const book = normalize(raw);
    book.sessions.forEach((s) => { if (!s.endedAt) s.endedAt = s.lastBeat || s.startedAt; });
    const now = new Date().toISOString();
    book.sessions.push({ startedAt: now, endedAt: null, lastBeat: now, chapter: book.currentChapterNumber, words0: this._wordCount(book) });
    this.data.books[id] = book;
    this._save();
  }
  beat(id) {
    const raw = this.data.books[id];
    if (!raw || !Array.isArray(raw.sessions) || !raw.sessions.length) return;
    const last = raw.sessions[raw.sessions.length - 1];
    if (!last.endedAt) { last.lastBeat = new Date().toISOString(); this._save(); }
  }
  endSession(id) {
    const raw = this.data.books[id];
    if (!raw) return;
    const book = normalize(raw);
    const last = book.sessions[book.sessions.length - 1];
    if (!last || last.endedAt) return;
    last.endedAt = new Date().toISOString();
    last.chapter = book.currentChapterNumber;
    last.wordsLearned = Math.max(0, this._wordCount(book) - (last.words0 || 0));
    this.data.books[id] = book;
    this._save();
  }
  getContinuity(id) {
    const raw = this.data.books[id];
    if (!raw) return null;
    const book = normalize(raw);
    const s = book.sessions[book.sessions.length - 1];
    if (!s) return null;
    const endedAt = s.endedAt || s.lastBeat || s.startedAt;
    const minutesAgo = Math.max(0, (Date.now() - new Date(endedAt).getTime()) / 60000);
    const durationMin = Math.max(1, Math.round((new Date(endedAt) - new Date(s.startedAt)) / 60000));
    return { endedAt, minutesAgo, durationMin, chapter: s.chapter || book.currentChapterNumber, wordsLearned: s.wordsLearned || 0 };
  }

  getModelContext(id) {
    const book = this.getBook(id);
    if (!book) return null;
    const withSummary = this.getChapters(id).filter((c) => c.summary);
    const older = withSummary.slice(0, -2);
    const overview = older.length
      ? `Book so far, across ${withSummary.length} chapters: ` + older.map((c) => `Ch.${c.number}: ${c.summary}`).join(" ")
      : null;
    return {
      currentChapterNumber: book.currentChapterNumber,
      overview,
      recentChapters: withSummary.slice(-2),
      currentChapterHasContent: !!(book.chapters[book.currentChapterNumber]?.summary),
    };
  }

  getStats() {
    const books = this.listBooks();
    let totalWords = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let wordsThisWeek = 0;
    for (const b of books) {
      for (const c of Object.values(b.chapters)) {
        totalWords += c.vocabLog.length;
        wordsThisWeek += c.vocabLog.filter((v) => new Date(v.timestamp).getTime() > weekAgo).length;
      }
    }
    const totalSessions = books.reduce((sum, b) => sum + b.sessionCount, 0);
    return { totalBooks: books.length, totalWords, totalSessions, wordsThisWeek };
  }

  getWeeklyVocabCounts() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 });
    }
    for (const b of this.listBooks()) {
      for (const c of Object.values(b.chapters)) {
        for (const v of c.vocabLog) {
          const key = new Date(v.timestamp).toDateString();
          const day = days.find((d) => d.key === key);
          if (day) day.count += 1;
        }
      }
    }
    return days;
  }

  exportData() {
    return JSON.stringify(this.data, null, 2);
  }
  importData(json) {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && parsed.books) {
      this.data = parsed;
      this._save();
      return true;
    }
    return false;
  }
}