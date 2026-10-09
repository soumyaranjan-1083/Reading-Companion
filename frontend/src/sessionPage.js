const DB_NAME = "rc-reading-page";
const STORE = "page";

function openPageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact(mode, action) {
  const db = await openPageDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Page storage was cancelled"));
    });
  } finally {
    db.close();
  }
}

export async function savePage(bookId, page) {
  if (page?.verification?.kind === "not_a_book_page" && Number(page.verification.confidence) >= 0.6) {
    throw new Error("rejected_page_photo");
  }
  if (page?.verification?.kind === "unreadable") throw new Error("rejected_page_photo");
  return transact("readwrite", (store) => store.put({ bookId, ...page }, "current"));
}

export async function loadPage(bookId) {
  const page = await transact("readonly", (store) => store.get("current"));
  return page?.bookId === bookId ? page : null;
}

export function createPageContextProvider(strategy = "inline-image") {
  if (strategy === "context-cache") throw new Error("Live API does not support cachedContent in session setup");
  if (strategy !== "inline-image") throw new Error(`Unknown page context strategy: ${strategy}`);
  let sentConnection = null;
  let sentVersion = null;
  return {
    async send(client, page, connectionId) {
      if (!pageCanBeSentToLive(page) || !client?.ready) return false;
      if (sentConnection === connectionId && sentVersion === page.updatedAt) return false;
      await client.sendVideoFrame(page.base64);
      sentConnection = connectionId;
      sentVersion = page.updatedAt;
      return true;
    },
  };
}

export function pageCanBeSentToLive(page) {
  return Boolean(page?.base64 && ["book_page", "screen_with_book_text"].includes(page.verification?.kind));
}

export function buildPageStatusNote(page, ghostMode = false) {
  const printedPageNumber = page?.pageNumber || page?.verification?.printedPageNumber || "unknown";
  const ghost = ghostMode
    ? "Author's Ghost Mode is on: use the author's broad themes without claiming to be the author."
    : "Author's Ghost Mode is off.";
  if (!page) {
    return `[SYSTEM NOTE] PAGE_STATUS: none. No page photo exists. Do not claim to see, read, or quote a page. ${ghost} Wait for the reader's question.`;
  }
  const verified = ["book_page", "screen_with_book_text"].includes(page.verification?.kind);
  const status = verified ? "verified_book_page" : "unverified";
  const transcription = String(page.verification?.text || "").trim();
  const textNote = verified
    ? `App transcription of the page (may contain OCR mistakes): <<<${transcription}>>>.`
    : `App transcription is unverified and must not be quoted: <<<${transcription}>>>.`;
  const unverifiedRule = verified
    ? "Use only visible text and this transcription; if they conflict or anything is unclear, say so and ask the reader."
    : "Do not claim to see, read, or quote this image, do not read lines verbatim, and ask the reader to read the line aloud.";
  return `[SYSTEM NOTE] PAGE_STATUS: ${status}. The reader says this image is their book page. ${textNote} Printed page number: ${printedPageNumber}. ${unverifiedRule} ${ghost} Wait for the reader's question.`;
}
