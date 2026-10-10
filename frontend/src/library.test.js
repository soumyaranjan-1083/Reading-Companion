import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { Library } from "./library.js";

function makeStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}
beforeEach(() => { globalThis.localStorage = makeStorage(); });
afterEach(() => { delete globalThis.localStorage; });

test("legacy vocabulary records normalize with safe optional-field defaults", () => {
  localStorage.setItem("reading_companion_library", JSON.stringify({ books: { b: { id: "b", title: "Book", chapters: { 1: { number: 1, vocabLog: [{ term: "quiet", meaning: "calm" }] } } } } }));
  const entry = new Library().getBook("b").chapters[1].vocabLog[0];
  assert.equal(entry.usageRegister, "uncertain");
  assert.equal(entry.practiceCount, 0);
  assert.equal(entry.recallSuccesses, 0);
  assert.deepEqual(entry.pronunciationHints, []);
});

test("practice, recall, and pronunciation observations update one vocabulary entry", () => {
  const library = new Library();
  const book = library.getOrCreateBook("Practice book");
  library.addVocab(book.id, 1, { term: "resilient", meaning: "able to recover", usageRegister: "everyday" });
  assert.equal(library.markVocabularyPracticed(book.id, 1, "resilient"), true);
  assert.equal(library.markVocabularyRecall(book.id, 1, "resilient", true), true);
  assert.equal(library.recordVocabularyPronunciation(book.id, 1, "resilient", "re-zil-yent"), true);
  const entry = library.getChapter(book.id, 1).vocabLog[0];
  assert.equal(entry.practiceCount, 1);
  assert.equal(entry.recallSuccesses, 1);
  assert.equal(entry.usageRegister, "everyday");
  assert.equal(entry.pronunciationHints[0].count, 1);
});

test("chapter deletion protects the last chapter and re-points the current chapter", () => {
  const library = new Library();
  const book = library.getOrCreateBook("Chapter safety");
  library.setChapterOutline(book.id, [
    { chapterNumber: 1, title: "First" },
    { chapterNumber: 2, title: "Second" },
  ]);
  library.setCurrentChapter(book.id, 2);
  const deleted = library.deleteChapter(book.id, 2);
  assert.deepEqual(deleted, { ok: true, currentChapterNumber: 1 });
  assert.equal(library.getChapter(book.id, 2), null);
  assert.equal(library.getBook(book.id).currentChapterNumber, 1);
  assert.deepEqual(library.deleteChapter(book.id, 1), { ok: false, reason: "last_chapter" });
});

test("books receive distinct stable tile colors, including legacy entries", () => {
  localStorage.setItem("reading_companion_library", JSON.stringify({
    books: {
      first: { id: "first", title: "First", tileColorIndex: 4 },
      duplicate: { id: "duplicate", title: "Duplicate", tileColorIndex: 4 },
      legacy: { id: "legacy", title: "Legacy" },
    },
  }));
  const library = new Library();
  const indexes = library.listBooks().map((book) => book.tileColorIndex);
  assert.equal(new Set(indexes).size, indexes.length);
  const added = library.getOrCreateBook("New manual book");
  assert.ok(!indexes.includes(added.tileColorIndex));
  assert.equal(library.getBook("first").tileColorIndex, 4);
});

test("deleted books leave the active library and restore with related data intact", () => {
  const library = new Library();
  const book = library.getOrCreateBook("Story to recover");
  library.setChapterOutline(book.id, [{ chapterNumber: 1, title: "Opening" }, { chapterNumber: 2, title: "Ending" }]);
  const related = { gems: [{ id: "gem-1", bookId: book.id }], conversation: "[{}]" };

  assert.equal(library.deleteBook(book.id, related), true);
  assert.equal(library.listBooks().some((entry) => entry.id === book.id), false);
  assert.equal(library.listDeletedBooks()[0].chapters[2].title, "Ending");
  assert.deepEqual(library.restoreBook(book.id), related);
  assert.equal(library.listBooks().some((entry) => entry.id === book.id), true);
  assert.equal(library.permanentlyDeleteBook(book.id), false);

  assert.equal(library.deleteBook(book.id, related), true);
  assert.equal(library.permanentlyDeleteBook(book.id), true);
  assert.equal(library.getBook(book.id), null);
});

test("chapter end pages are inferred from the next known chapter start only", () => {
  const library = new Library();
  const book = library.getOrCreateBook("Page ranges");
  library.setChapterOutline(book.id, [
    { chapterNumber: 1, title: "First", startPage: 11 },
    { chapterNumber: 2, title: "Second", startPage: 27 },
    { chapterNumber: 3, title: "Last", startPage: 45 },
  ]);
  assert.equal(library.getChapter(book.id, 1).endPage, 26);
  assert.equal(library.getChapter(book.id, 2).endPage, 44);
  assert.equal(library.getChapter(book.id, 3).endPage, null);

  library.setChapterPages(book.id, 2, 30);
  assert.equal(library.getChapter(book.id, 1).endPage, 29);
  assert.equal(library.getChapter(book.id, 2).endPage, 44);
  assert.equal(library.getChapter(book.id, 3).endPage, null);
});

test("textbook chapter sections, lesson authors, confidence, and book author role persist locally", () => {
  const library = new Library();
  const book = library.getOrCreateBook("Textbook");
  library.updateBookMeta(book.id, { authorType: "Publisher", authorName: "Learning House" });
  library.setChapterOutline(book.id, [{
    chapterNumber: 1, title: "The Last Leaf", section: "Prose", author: "O. Henry", startPage: 11, confidence: "low",
  }]);
  const saved = library.getBook(book.id);
  assert.equal(saved.authorType, "Publisher");
  assert.equal(saved.chapters[1].section, "Prose");
  assert.equal(saved.chapters[1].author, "O. Henry");
  assert.equal(saved.chapters[1].confidence, "low");
  assert.equal(saved.chapters[1].startPage, 11);
});
