import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanChapterTitle,
  fetchBookDetails,
  fetchAuthorBio,
  findBooks,
  fetchTocByIsbn,
  normalizeToc,
  parseVisionContents,
  parseVisionContentsWithRetry,
  parseVisionChapters,
  validateImages,
} from "./bookLookup.js";

const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

function buildFetchStub({ searchDocs = [], editionsByWork = {}, editionsByIsbn = {}, googleItems = null }) {
  return (url) => {
    if (url.includes("googleapis.com")) {
      return googleItems == null ? json({}, 429) : json({ items: googleItems });
    }
    if (url.includes("/search.json?")) return json({ docs: searchDocs });
    const workMatch = /\/works\/([^/]+)\/editions\.json/.exec(url);
    if (workMatch) return json({ entries: editionsByWork[`/works/${workMatch[1]}`] || [] });
    const isbnMatch = /\/isbn\/([^/.]+)\.json/.exec(url);
    if (isbnMatch) return json(editionsByIsbn[isbnMatch[1]] || {});
    return json({}, 404);
  };
}

test("falls back to Google when Open Library is unavailable", async () => {
  const fetchImpl = (url) => (url.includes("openlibrary.org/search.json")
    ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
    : json({ items: [{ id: "x", volumeInfo: { title: "Deep Work", authors: ["Cal Newport"], industryIdentifiers: [{ identifier: "9781455586691" }], imageLinks: { thumbnail: "http://img/x" }, language: "en" } }] }));
  const result = await findBooks("deep work", { fetchImpl });
  assert.equal(result.via, "google");
  assert.equal(result.books[0].coverUrl, "https://img/x");
});

test("search prefers the translated courage work over the wrong exact-title work", async () => {
  const searchDocs = [
    { key: "/works/OL19744000W", title: "嫌われる勇気", author_name: ["Ichirō Kishimi", "Fumitake Koga"], edition_count: 17, cover_i: 10873626, first_publish_year: 2013, language: ["eng", "jpn"] },
    { key: "/works/OL39171653W", title: "Complete Courage to Be Disliked Duology Boxed Set", author_name: ["Ichirō Kishimi", "Fumitake Koga"], edition_count: 1, first_publish_year: 2024, language: ["eng"] },
    { key: "/works/OL44998170W", title: "The Courage to Be Disliked", author_name: ["Namita Gokhale"], edition_count: 1, cover_i: 15179268, first_publish_year: 2021, language: ["eng"] },
  ];
  const editionsByWork = {
    "/works/OL19744000W": [
      { key: "/books/OL26957069M", title: "The courage to be disliked", publishers: ["Atria Books"], publish_date: "2018", isbn_13: ["9781501197277"], languages: [{ key: "/languages/eng" }], covers: [10873626] },
      { key: "/books/OL27161408M", title: "Kirawareru yūki", publishers: ["Diamond"], publish_date: "2013", isbn_13: ["9784478025819"], languages: [{ key: "/languages/jpn" }] },
    ],
    "/works/OL39171653W": [
      { key: "/books/OL53324057M", title: "Complete Courage to Be Disliked Duology Boxed Set", publishers: ["Atria"], publish_date: "2024", isbn_13: ["9781668088067"], languages: [{ key: "/languages/eng" }] },
    ],
    "/works/OL44998170W": [
      { key: "/books/OL61391908M", title: "Never Never Land", publishers: ["Speaking Tiger Books"], publish_date: "2021", isbn_13: ["9789354477041"], languages: [{ key: "/languages/eng" }], covers: [15179268] },
    ],
  };
  const fetchImpl = buildFetchStub({ searchDocs, editionsByWork });

  for (const query of ["The Courage to Be Disliked", "THE COURAGE TO BE DISLIKED", "courage to be disliked"]) {
    const result = await findBooks(query, { fetchImpl });
    assert.equal(result.via, "openlibrary");
    assert.equal(result.books[0].workKey, "/works/OL19744000W");
    assert.equal(result.books[0].title, "The courage to be disliked");
    assert.deepEqual(result.books[0].authors, ["Ichirō Kishimi", "Fumitake Koga"]);
    assert.equal(result.books[0].coverUrl, "https://covers.openlibrary.org/b/id/10873626-L.jpg");
  }
});

test("details keep chapters and metadata on the same edition and surface TOC badges", async () => {
  const fetchImpl = buildFetchStub({
    editionsByWork: {
      "/works/OL19744000W": [
        { key: "/books/OL26957069M", title: "The courage to be disliked", publishers: ["Atria Books"], publish_date: "2018", isbn_13: ["9781501197277"], languages: [{ key: "/languages/eng" }], covers: [10873626] },
        { key: "/books/OL32305074M", title: "The Courage To Be Disliked", publishers: ["Allen & Unwin"], publish_date: "2018", isbn_13: ["9781760630720"], languages: [{ key: "/languages/eng" }], covers: [10930013] },
      ],
    },
    editionsByIsbn: {
      "9781501197277": {
        title: "The courage to be disliked",
        table_of_contents: [
          { level: 0, title: "Chapter 1 The Unknown Third Giant", pagenum: "1" },
          { level: 0, title: "Chapter 2 Why People Can Change", pagenum: "23" },
        ],
      },
      "9781760630720": {
        title: "The Courage To Be Disliked",
        table_of_contents: [{ level: 0, title: "Only one", pagenum: "1" }],
      },
    },
  });

  const details = await fetchBookDetails({
    workKey: "/works/OL19744000W",
    title: "The Courage to Be Disliked",
    authors: ["Ichirō Kishimi", "Fumitake Koga"],
  }, { fetchImpl });

  assert.equal(details.editions[0].title, "The courage to be disliked");
  assert.equal(details.editions[0].primaryIsbn, "9781501197277");
  assert.equal(details.editions[0].tocAvailable, true);
  assert.deepEqual(details.editions[0].chapters.map((chapter) => chapter.title), ["The Unknown Third Giant", "Why People Can Change"]);
  assert.equal(details.editions[1].title, "The Courage To Be Disliked");
  assert.equal(details.editions[1].primaryIsbn, "9781760630720");
  assert.equal(details.editions[1].tocAvailable, false);
  assert.equal(details.editions[1].chapters.length, 0);
});

test("normalizeToc keeps top level and optional pages", () => {
  const out = normalizeToc([{ level: 0, label: "1", title: "Start", pagenum: "3" }, { level: 1, title: "Sub" }, { level: 0, title: "End" }]);
  assert.deepEqual(out.map((chapter) => [chapter.title, chapter.startPage]), [["Start", 3], ["End", null]]);
  assert.equal(out[0].endPage, undefined);
});

test("normalizeToc infers end pages from the next known start and leaves the last open", () => {
  const out = normalizeToc([
    { level: 0, title: "First", pagenum: "3" },
    { level: 0, title: "Second", pagenum: "12" },
    { level: 0, title: "Last", pagenum: "31" },
  ]);
  assert.deepEqual(out.map(({ startPage, endPage }) => [startPage, endPage]), [[3, 11], [12, 30], [31, undefined]]);
});

test("fetchAuthorBio falls back to an exact Open Library author record", async () => {
  const fetchImpl = (url) => {
    if (url.includes("wikipedia.org")) return json({ type: "disambiguation", extract: "" });
    if (url.includes("/search/authors.json")) {
      return json({ docs: [{ name: "Ursula K. Le Guin", key: "/authors/OL27349A" }] });
    }
    if (url.endsWith("/authors/OL27349A.json")) {
      return json({ bio: { value: "Ursula K. Le Guin was an American author known for speculative fiction." } });
    }
    return json({}, 404);
  };
  assert.equal(
    await fetchAuthorBio("Ursula K. Le Guin", { fetchImpl }),
    "Ursula K. Le Guin was an American author known for speculative fiction."
  );
});

test("fetchAuthorBio does not return a similarly named author's biography", async () => {
  const fetchImpl = (url) => url.includes("wikipedia.org")
    ? json({ type: "disambiguation", extract: "" })
    : json({ docs: [{ name: "Ursula K. Le Guin (editor)", key: "/authors/OL27349A" }] });
  assert.equal(await fetchAuthorBio("Ursula K. Le Guin", { fetchImpl }), "");
});

test("a single-entry table of contents is not trusted", async () => {
  const fetchImpl = () => json({ table_of_contents: [{ title: "Only one" }] });
  assert.equal((await fetchTocByIsbn(["9780132350884"], { fetchImpl })).chapters.length, 0);
});

test("vision output never gains chapters and bad input is empty", () => {
  assert.equal(parseVisionChapters("not json").length, 0);
  assert.deepEqual(parseVisionChapters('{"chapters":[{"title":"A","page":1},{"title":"a"},{"title":"B","page":null}]}').map((chapter) => chapter.title), ["A", "B"]);
});

test("strict contents schema preserves self-help titles, pages, and nullable fields", () => {
  const parsed = parseVisionContents(JSON.stringify({ chapters: [
    { section: null, title: "Start with Why", author: null, startPage: 3, confidence: "high" },
    { section: null, title: "Find Your Why", author: null, startPage: null, confidence: "medium" },
  ] }));
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.chapters.map(({ title, startPage, author }) => [title, startPage, author]), [
    ["Start with Why", 3, null], ["Find Your Why", null, null],
  ]);
});

test("textbook sections and lesson authors stay separate from chapter titles", () => {
  const parsed = parseVisionContents(JSON.stringify({ chapters: [
    { section: "Prose", title: "The Last Leaf", author: "O. Henry", startPage: 11, confidence: "high" },
    { section: "Poetry", title: "Daffodils", author: "William Wordsworth", startPage: 29, confidence: "high" },
  ] }));
  assert.deepEqual(parsed.chapters.map(({ section, title, author }) => [section, title, author]), [
    ["Prose", "The Last Leaf", "O. Henry"], ["Poetry", "Daffodils", "William Wordsworth"],
  ]);
});

test("messy and person-name-looking rows are flagged low without editing their titles", () => {
  const parsed = parseVisionContents(JSON.stringify({ chapters: [
    { section: "Prose", title: "O. Henry", author: "O. Henry", startPage: 11, confidence: "high" },
    { section: "Poetry", title: "Daffodils", author: null, startPage: null, confidence: "low" },
  ] }));
  assert.equal(parsed.chapters[0].title, "O. Henry");
  assert.equal(parsed.chapters[0].confidence, "low");
  assert.equal(parsed.chapters[1].confidence, "low");
});

test("unreadable and non-contents model results remain explicit", () => {
  assert.deepEqual(parseVisionContents('{"error":"unreadable"}'), { error: "unreadable" });
  assert.deepEqual(parseVisionContents('{"error":"not_contents_page"}'), { error: "not_contents_page" });
});

test("malformed vision schemas are rejected instead of silently dropping rows", () => {
  assert.deepEqual(parseVisionContents("not JSON"), { error: "malformed" });
  assert.deepEqual(parseVisionContents('{"chapters":[{"title":"Bad row","page":"?"}]}'), { error: "malformed" });
});

test("malformed contents output retries once, then safely falls back", async () => {
  let calls = 0;
  const result = await parseVisionContentsWithRetry(async () => { calls += 1; return "not JSON"; });
  assert.equal(calls, 2);
  assert.deepEqual(result, { error: "unreadable", reason: "schema_mismatch" });
});

test("explicit unreadable output is not retried", async () => {
  let calls = 0;
  const result = await parseVisionContentsWithRetry(async () => { calls += 1; return '{"error":"unreadable"}'; });
  assert.equal(calls, 1);
  assert.deepEqual(result, { error: "unreadable" });
});

test("image validation", () => {
  assert.equal(validateImages(["data:text/html;base64,AAAA"]), null);
  assert.equal(validateImages(["data:image/jpeg;base64,AAAA"]).length, 1);
});

test("printed chapter prefixes are removed", () => {
  assert.equal(cleanChapterTitle("Chapter 2 Meaningful Names"), "Meaningful Names");
  assert.equal(cleanChapterTitle("3. Functions"), "Functions");
  assert.equal(cleanChapterTitle("Chapter 4: Comments"), "Comments");
  assert.equal(cleanChapterTitle("Chapter 7"), "Chapter 7");
  assert.equal(cleanChapterTitle("1984 Revisited"), "1984 Revisited");
});
