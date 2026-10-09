import test from "node:test";
import assert from "node:assert/strict";
import { buildPageStatusNote, createPageContextProvider, pageCanBeSentToLive, savePage } from "./sessionPage.js";

test("inline page is sent once per connection or new page", async () => {
  const sent = [];
  const client = { ready: true, sendVideoFrame: async (image) => sent.push(image) };
  const provider = createPageContextProvider();
  const page = { base64: "page-one", updatedAt: 1, verification: { kind: "book_page" } };
  assert.equal(await provider.send(client, page, 1), true);
  assert.equal(await provider.send(client, page, 1), false);
  assert.equal(await provider.send(client, page, 2), true);
  assert.equal(await provider.send(client, { base64: "page-two", updatedAt: 2, verification: { kind: "book_page" } }, 2), true);
  assert.deepEqual(sent, ["page-one", "page-one", "page-two"]);
});

test("cache strategy fails explicitly for Live", () => {
  assert.throws(() => createPageContextProvider("context-cache"), /does not support cachedContent/);
});

test("unverified and rejected photos are never sent to Live or saved", async () => {
  const sent = [];
  const provider = createPageContextProvider();
  const client = { ready: true, sendVideoFrame: async (image) => sent.push(image) };
  const unverified = { base64: "unverified", verification: { kind: "not_a_book_page", confidence: 0.4 }, updatedAt: 1 };
  const rejected = { base64: "rejected", verification: { kind: "not_a_book_page", confidence: 0.9 } };
  assert.equal(pageCanBeSentToLive(unverified), false);
  assert.equal(await provider.send(client, unverified, 1), false);
  await assert.rejects(savePage("book", rejected), /rejected_page_photo/);
  await assert.rejects(savePage("book", { base64: "unreadable", verification: { kind: "unreadable", confidence: 0.8 } }), /rejected_page_photo/);
  assert.deepEqual(sent, []);
});

test("PAGE_STATUS notes never assert visibility for unverified images or no image", () => {
  const unverified = buildPageStatusNote({ verification: { kind: "not_a_book_page", confidence: 0.3, text: "possible text" } });
  const none = buildPageStatusNote(null);
  assert.match(unverified, /PAGE_STATUS: unverified/);
  assert.match(unverified, /must not be quoted/);
  assert.match(unverified, /Do not claim to see, read, or quote this image/);
  assert.match(none, /PAGE_STATUS: none/);
  assert.match(none, /No page photo exists/);
  assert.doesNotMatch(none, /reader shared a page photo|fixed photo/i);
});
