// Public book catalogue lookups. Only public details are read (title, author, ISBN, cover,
// table of contents). Nothing here reads or fetches the book itself.
const UA = "ReadingCompanion/1.0 (personal reading app)";
const MAX_ISBNS = 4;
const MAX_CHAPTERS = 200;
const MAX_WORK_RESULTS = 6;
const MAX_WORK_EDITION_PREVIEWS = 10;
const MAX_EDITION_RESULTS = 8;
const OPEN_LIBRARY_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "isbn",
  "cover_i",
  "first_publish_year",
  "edition_count",
  "language",
  "edition_key",
].join(",");
const LANGUAGE_NAMES = {
  ara: "Arabic",
  ben: "Bengali",
  chi: "Chinese",
  eng: "English",
  fre: "French",
  ger: "German",
  gre: "Greek",
  hin: "Hindi",
  ita: "Italian",
  jpn: "Japanese",
  kor: "Korean",
  mar: "Marathi",
  nep: "Nepali",
  ori: "Odia",
  pan: "Punjabi",
  por: "Portuguese",
  rus: "Russian",
  spa: "Spanish",
  tam: "Tamil",
  tel: "Telugu",
  urd: "Urdu",
};
const RESULT_PENALTY = /\b(summary|workbook|journal|planner|notebook|study guide|guidebook|boxed set|duology|companion)\b/i;
const tocCache = new Map();

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const fold = (s) => clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const norm = (s) => fold(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const first = (list) => (Array.isArray(list) && list.length ? list[0] : "");
const uniq = (list) => [...new Set(list.filter(Boolean))];
const yearFrom = (value) => String(value || "").match(/\b(1[6-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1] || "";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const buildCoverUrl = (coverId) => Number.isFinite(Number(coverId)) && Number(coverId) > 0 ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : "";

function uniqueBy(list, keyFn) {
  const seen = new Set();
  return list.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleVariants(title) {
  const base = clean(title).slice(0, 160);
  const short = clean(base.split(/\s*[:([|/-]\s*/)[0]);
  return uniq([`"${base}"`, base, short]).filter((value) => value.length >= 2);
}

function tokenSet(title) {
  return norm(title).split(" ").filter(Boolean);
}

function titleSimilarity(query, candidate) {
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 32;
  if (c.startsWith(q) || q.startsWith(c)) return 26;
  if (c.includes(q) || q.includes(c)) return 21;
  const qTokens = tokenSet(query);
  const cTokens = new Set(tokenSet(candidate));
  if (!qTokens.length || !cTokens.size) return 0;
  const overlap = qTokens.filter((token) => cTokens.has(token)).length / qTokens.length;
  return Math.round(overlap * 18);
}

function resultPenalty(title) {
  return RESULT_PENALTY.test(clean(title)) ? 34 : 0;
}

function readLanguageCodes(list) {
  return uniq((list || []).map((entry) => String(entry?.key || entry || "").replace(/^\/languages\//, "").trim().toLowerCase()).filter(Boolean));
}

function primaryLanguageName(list) {
  const code = readLanguageCodes(list)[0];
  return LANGUAGE_NAMES[code] || (code ? code.toUpperCase() : "");
}

function pickIsbns(list) {
  const out = [];
  for (const value of list || []) {
    const digits = String(value).replace(/[^0-9Xx]/g, "");
    if ((digits.length === 13 || digits.length === 10) && !out.includes(digits)) out.push(digits);
  }
  return out.sort((a, b) => b.length - a.length).slice(0, MAX_ISBNS);
}

async function getJson(fetchImpl, url, { timeoutMs = 8000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctl.signal, redirect: "follow" });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function mapGoogleVolume(item) {
  const info = item?.volumeInfo || {};
  const isbns = pickIsbns((info.industryIdentifiers || []).map((entry) => entry.identifier));
  const cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  return {
    key: `g:${item?.id || ""}`,
    workKey: "",
    title: clean([info.title, info.subtitle].filter(Boolean).join(": ")),
    authors: (info.authors || []).map(clean).filter(Boolean),
    isbns,
    coverUrl: cover.replace(/^http:/, "https:").replace("&edge=curl", ""),
    year: yearFrom(info.publishedDate),
    language: clean(info.language || "").toUpperCase(),
    editionCount: 1,
    source: "google",
  };
}

export function mapOpenLibraryDoc(doc) {
  return {
    key: `w:${doc?.key || ""}`,
    workKey: doc?.key || "",
    title: clean(doc?.title),
    authors: (doc?.author_name || []).map(clean).filter(Boolean),
    isbns: pickIsbns(doc?.isbn),
    coverUrl: buildCoverUrl(doc?.cover_i),
    year: doc?.first_publish_year ? String(doc.first_publish_year) : "",
    language: primaryLanguageName(doc?.language),
    editionCount: Number(doc?.edition_count) || 0,
    source: "openlibrary",
  };
}

function mapEdition(entry, fallback = {}) {
  const isbns = pickIsbns([...(entry?.isbn_13 || []), ...(entry?.isbn_10 || []), ...(entry?.identifiers?.isbn_13 || []), ...(entry?.identifiers?.isbn_10 || [])]);
  const authors = (fallback.authors || []).map(clean).filter(Boolean);
  const title = clean([entry?.title, entry?.subtitle].filter(Boolean).join(": "));
  return {
    key: `e:${entry?.key || ""}`,
    editionKey: entry?.key || "",
    workKey: entry?.works?.[0]?.key || fallback.workKey || "",
    title,
    authors,
    isbns,
    primaryIsbn: first(isbns),
    coverUrl: buildCoverUrl(first(entry?.covers)),
    year: yearFrom(entry?.publish_date || entry?.copyright_date),
    publisher: clean(first(entry?.publishers)),
    language: primaryLanguageName(entry?.languages),
    source: "openlibrary",
  };
}

function workScore(query, doc, index, variantIndex) {
  const editionBonus = Math.min(14, Math.round(Math.log2((Number(doc?.edition_count) || 0) + 1) * 4));
  return 130 - (index * 12) - (variantIndex * 4) + titleSimilarity(query, doc?.title) + editionBonus + (doc?.cover_i ? 4 : 0) + ((doc?.author_name || []).length ? 3 : 0) - resultPenalty(doc?.title);
}

function editionScore(query, edition, index = 0) {
  return titleSimilarity(query, edition.title) + (edition.coverUrl ? 8 : 0) + (edition.primaryIsbn ? 6 : 0) + (/english/i.test(edition.language) ? 6 : 0) + (edition.publisher ? 3 : 0) - resultPenalty(edition.title) - index;
}

async function searchGoogle(fetchImpl, title, apiKey) {
  const params = new URLSearchParams({
    q: `intitle:${title}`,
    maxResults: "8",
    printType: "books",
    fields: "items(id,volumeInfo(title,subtitle,authors,publishedDate,industryIdentifiers,imageLinks,language))",
  });
  if (apiKey) params.set("key", apiKey);
  const json = await getJson(fetchImpl, `https://www.googleapis.com/books/v1/volumes?${params}`);
  return (json.items || []).map(mapGoogleVolume).filter((book) => book.title && book.authors.length);
}

async function searchOpenLibraryWorks(fetchImpl, title) {
  const merged = new Map();
  const variants = titleVariants(title);
  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const params = new URLSearchParams({ q: variants[variantIndex], limit: "14", fields: OPEN_LIBRARY_FIELDS });
    const json = await getJson(fetchImpl, `https://openlibrary.org/search.json?${params}`);
    (json.docs || []).forEach((doc, index) => {
      const key = clean(doc?.key);
      if (!key) return;
      const existing = merged.get(key);
      const next = {
        ...doc,
        _rank: workScore(title, doc, index, variantIndex),
        _index: index,
        _variantIndex: variantIndex,
      };
      if (!existing || next._rank > existing._rank) merged.set(key, next);
    });
  }
  return [...merged.values()].sort((a, b) => b._rank - a._rank || a._index - b._index);
}

async function fetchWorkEditions(workKey, { fetchImpl = fetch, limit = 18, authors = [] } = {}) {
  const normalized = clean(String(workKey || "").replace(/^w:/, ""));
  if (!normalized.startsWith("/works/")) return [];
  const workId = normalized.replace(/^\/works\//, "");
  const json = await getJson(fetchImpl, `https://openlibrary.org/works/${encodeURIComponent(workId)}/editions.json?limit=${limit}`, { timeoutMs: 12_000 });
  return (json.entries || []).map((entry) => mapEdition(entry, { workKey: normalized, authors })).filter((edition) => edition.title || edition.primaryIsbn);
}

async function fetchBestEditionPreview(query, work, { fetchImpl = fetch } = {}) {
  try {
    const editions = await fetchWorkEditions(work.workKey, { fetchImpl, limit: MAX_WORK_EDITION_PREVIEWS, authors: work.authors });
    if (!editions.length) return null;
    return [...editions]
      .map((edition, index) => ({ ...edition, _score: editionScore(query, edition, index) }))
      .sort((a, b) => b._score - a._score || Number(b.year) - Number(a.year))
      .at(0) || null;
  } catch {
    return null;
  }
}

function dedupeEditions(editions) {
  return uniqueBy(editions, (edition) => `${norm(edition.title)}|${norm(edition.publisher)}|${edition.year}|${edition.primaryIsbn || edition.editionKey}`);
}

async function mapLimit(list, limit, mapper) {
  const out = new Array(list.length);
  let index = 0;
  async function worker() {
    while (index < list.length) {
      const current = index;
      index += 1;
      out[current] = await mapper(list[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, worker));
  return out;
}

async function cachedToc(isbns, { fetchImpl = fetch } = {}) {
  const key = pickIsbns(isbns).join("|");
  if (!key) return { chapters: [], isbn: null };
  const cacheKey = `${key}`;
  if (fetchImpl === fetch && tocCache.has(cacheKey)) return tocCache.get(cacheKey);
  const promise = fetchTocByIsbn(isbns, { fetchImpl }).catch(() => ({ chapters: [], isbn: null }));
  if (fetchImpl === fetch) tocCache.set(cacheKey, promise);
  return promise;
}

function fallbackEdition(candidate) {
  return {
    key: `e:${candidate?.editionKey || candidate?.key || ""}`,
    editionKey: candidate?.editionKey || "",
    workKey: candidate?.workKey || "",
    title: clean(candidate?.title),
    authors: (candidate?.authors || []).map(clean).filter(Boolean),
    isbns: pickIsbns(candidate?.isbns),
    primaryIsbn: first(pickIsbns(candidate?.isbns)),
    coverUrl: clean(candidate?.coverUrl),
    year: clean(candidate?.year),
    publisher: clean(candidate?.publisher),
    language: clean(candidate?.language),
    source: candidate?.source || "google",
  };
}

// Open Library q-search is more reliable for translated books than the title= filter.
// The title search route can return mixed metadata, so we always hydrate results from a real
// work/edition before showing them to the user.
export async function findBooks(title, { fetchImpl = fetch, googleKey = "" } = {}) {
  const query = clean(title).slice(0, 160);
  if (query.length < 2) return { books: [], via: null };

  let works = [];
  try {
    works = await searchOpenLibraryWorks(fetchImpl, query);
  } catch {
    works = [];
  }

  if (works.length) {
    const base = works.slice(0, MAX_WORK_RESULTS).map(mapOpenLibraryDoc);
    const hydrated = await mapLimit(base, 3, async (work) => {
      const preview = await fetchBestEditionPreview(query, work, { fetchImpl });
      return {
        ...work,
        title: clean(preview?.title || work.title || query),
        coverUrl: clean(preview?.coverUrl || work.coverUrl),
        year: clean(preview?.year || work.year),
        language: clean(preview?.language || work.language),
        isbns: pickIsbns(preview?.isbns || work.isbns),
      };
    });
    // Re-rank on the title of the hydrated edition: a translated book's work title can be in another language.
    const ranked = hydrated
      .filter((book) => book.title)
      .map((book, index) => ({ book, sim: titleSimilarity(query, book.title), score: 100 - index * 6 + titleSimilarity(query, book.title) * 2 - resultPenalty(book.title) }))
      .sort((a, b) => b.score - a.score);
    const bestSim = Math.max(0, ...ranked.map((r) => r.sim));
    const kept = bestSim >= 21 ? ranked.filter((r) => r.sim >= 12) : ranked;
    return { books: kept.map((r) => r.book), via: "openlibrary" };
  }

  try {
    const google = await searchGoogle(fetchImpl, query, googleKey);
    return { books: uniqueBy(google, (book) => `${norm(book.title)}|${norm(book.authors[0])}`).slice(0, 6), via: google.length ? "google" : null };
  } catch {
    return { books: [], via: null, unavailable: true };
  }
}

export async function fetchBookDetails(candidate, { fetchImpl = fetch } = {}) {
  const query = clean(candidate?.title).slice(0, 160);
  const fallback = fallbackEdition(candidate);
  if (!candidate?.workKey) {
    const toc = await cachedToc(fallback.isbns, { fetchImpl });
    return { editions: [{ ...fallback, tocAvailable: toc.chapters.length >= 2, chapters: toc.chapters }] };
  }

  let editions = [];
  try {
    editions = await fetchWorkEditions(candidate.workKey, { fetchImpl, authors: candidate.authors, limit: 18 });
  } catch {
    editions = [];
  }
  if (!editions.length) editions = [fallback];

  const ranked = dedupeEditions(editions)
    .map((edition, index) => ({ ...edition, _score: editionScore(query, edition, index) }))
    .sort((a, b) => b._score - a._score || Number(b.year) - Number(a.year))
    .slice(0, MAX_EDITION_RESULTS);

  const enriched = await mapLimit(ranked, 3, async (edition) => {
    const toc = await cachedToc(edition.isbns, { fetchImpl });
    return {
      ...edition,
      tocAvailable: toc.chapters.length >= 2,
      chapters: toc.chapters,
    };
  });

  return {
    editions: enriched.sort((a, b) => Number(b.tocAvailable) - Number(a.tocAvailable) || b._score - a._score || Number(b.year) - Number(a.year)).map(({ _score, ...edition }) => edition),
  };
}

// The app numbers chapters itself, so printed prefixes such as "Chapter 3" or "4." are removed.
export function cleanChapterTitle(title) {
  const original = clean(title);
  const stripped = original.replace(/^(?:chapter|chap\.?|ch\.?|part)\s*(?:\d+|[ivxlc]+)\b\s*[:.\-–—)]*\s*/i, "").replace(/^\d{1,3}\s*[:.\-–—)]\s*/, "").replace(/^\d{1,3}\s+(?=[A-Za-z])/, "").trim();
  return stripped.length >= 2 ? stripped : original;
}

export function normalizeToc(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = raw
    .map((entry) => {
      const title = clean(entry?.title);
      const label = clean(entry?.label);
      const page = Number.parseInt(String(entry?.pagenum ?? "").replace(/[^0-9]/g, ""), 10);
      return { level: Number(entry?.level) || 0, title: title || label, label: title ? label : "", page: Number.isFinite(page) && page > 0 ? page : null };
    })
    .filter((entry) => entry.title && entry.title.length <= 160);
  const top = rows.filter((entry) => entry.level === 0);
  const chosen = top.length >= 2 ? top : rows;
  const chapters = chosen.slice(0, MAX_CHAPTERS);
  return chapters.map((entry, index) => {
    const nextPage = chapters[index + 1]?.page;
    const chapter = { number: index + 1, title: cleanChapterTitle(entry.title), startPage: entry.page };
    if (Number.isFinite(entry.page) && Number.isFinite(nextPage) && nextPage > entry.page) chapter.endPage = nextPage - 1;
    return chapter;
  });
}

// A table of contents is only trusted if it has at least two real entries.
export async function fetchTocByIsbn(isbns, { fetchImpl = fetch } = {}) {
  for (const isbn of (isbns || []).slice(0, MAX_ISBNS)) {
    try {
      const edition = await getJson(fetchImpl, `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
      const chapters = normalizeToc(edition?.table_of_contents);
      if (chapters.length >= 2) return { chapters, isbn };
    } catch {
      // Try the next ISBN.
    }
  }
  return { chapters: [], isbn: null };
}

export function parseVisionChapters(text) {
  let data;
  try {
    data = JSON.parse(String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : data?.chapters;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const title = cleanChapterTitle(entry?.title);
    if (!title || title.length > 160) continue;
    const page = Number.parseInt(String(entry?.page ?? ""), 10);
    const key = norm(title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ number: out.length + 1, title, startPage: Number.isFinite(page) && page > 0 ? page : null });
    if (out.length >= MAX_CHAPTERS) break;
  }
  return out;
}

function looksLikePersonName(value) {
  const words = String(value || "").trim().split(/\s+/u);
  return words.length >= 2 && words.length <= 5 && words.every((word) => /^[\p{Lu}][\p{L}'’.\-]*$/u.test(word));
}

export function parseVisionContents(text) {
  let data;
  try {
    data = JSON.parse(String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return { error: "malformed" };
  }
  if (data?.error === "unreadable" || data?.error === "not_contents_page") return { error: data.error };
  if (!data || !Array.isArray(data.chapters) || !data.chapters.length) return { error: "malformed" };
  const rows = data.chapters.slice(0, MAX_CHAPTERS);
  if (rows.some((entry) => !entry || typeof entry !== "object" ||
      typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 160 ||
      !(entry.section === null || typeof entry.section === "string") ||
      !(entry.author === null || typeof entry.author === "string") ||
      !(entry.startPage === null || (Number.isInteger(entry.startPage) && entry.startPage > 0)) ||
      !["high", "medium", "low"].includes(entry.confidence))) return { error: "malformed" };

  const repeatedTitles = new Map();
  for (const entry of rows) {
    const key = norm(entry.title);
    repeatedTitles.set(key, (repeatedTitles.get(key) || 0) + 1);
  }
  const chapters = rows.map((entry, index) => {
    const title = cleanChapterTitle(entry.title);
    const author = entry.author?.trim() || null;
    const repeats = (repeatedTitles.get(norm(title)) || 0) > 1;
    const titleLooksLikeAuthor = Boolean(author && norm(title) === norm(author));
    const suspiciousName = looksLikePersonName(title) && (titleLooksLikeAuthor || repeats);
    return {
      number: index + 1,
      section: entry.section?.trim() || null,
      title,
      author,
      startPage: entry.startPage,
      confidence: suspiciousName ? "low" : entry.confidence,
    };
  });
  return { chapters };
}

export async function parseVisionContentsWithRetry(request) {
  let parsed = { error: "malformed" };
  for (let attempt = 0; attempt < 2 && parsed.error === "malformed"; attempt += 1) {
    parsed = parseVisionContents(await request(attempt));
  }
  return parsed.error === "malformed" ? { error: "unreadable", reason: "schema_mismatch" } : parsed;
}

export const TOC_VISION_PROMPT =
  "These photos show one or more contents pages from ONE book. Read all photos together in page order. Return each lesson or chapter as one entry. " +
  "The title is ALWAYS the lesson or chapter title. Never use a person's name as the title; put a name printed next to a lesson in author. " +
  "Group headings such as Prose, Poetry, Drama, Unit 2, Section A, or a subject are section labels, not chapters. " +
  "Ignore handwriting, underlines, doodles, ticks, margin notes, and phone UI. If handwriting obscures a printed entry, keep the visible entry only when possible and set confidence low; never guess a title or page. " +
  "Handle multiple columns, dotted leaders, Roman-numeral front matter, and numbering that restarts by unit. Skip front matter that is not a lesson. Preserve the printed script exactly; do not translate or transliterate. " +
  "If this is not a contents page return {\"error\":\"not_contents_page\"}. If it is too blurry, cropped, or unreadable return {\"error\":\"unreadable\"}. " +
  'Otherwise return JSON only: {"chapters":[{"section":string|null,"title":string,"author":string|null,"startPage":number|null,"confidence":"high"|"medium"|"low"}]}.';

export function validateImages(images, { maxCount = 6, maxBytesEach = 1_800_000 } = {}) {
  if (!Array.isArray(images) || !images.length || images.length > maxCount) return null;
  const out = [];
  for (const img of images) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img || ""));
    if (!match || Math.floor((match[2].length * 3) / 4) > maxBytesEach) return null;
    out.push({ mimeType: match[1], data: match[2] });
  }
  return out;
}

function authorBioText(value) {
  const text = clean(typeof value === "string" ? value : value?.value);
  return text.slice(0, 420);
}

// Prefer a verified Wikipedia extract, then an exact-name Open Library author record.
export async function fetchAuthorBio(name, { fetchImpl = fetch } = {}) {
  const who = clean(name).slice(0, 80);
  if (!who) return "";
  try {
    const json = await getJson(fetchImpl, `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(who.replace(/ /g, "_"))}?redirect=true`, { timeoutMs: 6000 });
    const text = clean(json?.extract);
    const hint = `${json?.description || ""} ${text}`;
    if (json?.type === "standard" && /author|writer|novelist|poet|essayist|journalist|philosopher|psychologist|engineer|speaker|entrepreneur|scientist|historian|economist/i.test(hint)) {
      const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
      const bio = sentences.slice(0, 3).join("").trim().slice(0, 420);
      if (bio) return bio;
    }
  } catch {
    // Try another public source when Wikipedia is unavailable or has no usable summary.
  }
  try {
    const search = await getJson(fetchImpl, `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(who)}&limit=5`, { timeoutMs: 6000 });
    const wanted = who.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const author = (search?.docs || []).find((entry) =>
      clean(entry?.name).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() === wanted &&
      typeof entry?.key === "string" && /^\/authors\/OL\d+A$/.test(entry.key)
    );
    if (!author) return "";
    const record = await getJson(fetchImpl, `https://openlibrary.org${author.key}.json`, { timeoutMs: 6000 });
    return authorBioText(record?.bio);
  } catch {
    return "";
  }
}
