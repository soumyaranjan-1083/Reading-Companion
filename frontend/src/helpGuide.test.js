import assert from "node:assert/strict";
import test from "node:test";
import { buildShortHelpAnswer, findRelevantHelp, getRelevantHelp, HELP_GUIDE } from "./helpGuide.js";

const top = (question) => getRelevantHelp(question)?.id;

test("guide ids are unique and every demo is a known animation", () => {
  assert.equal(new Set(HELP_GUIDE.map((entry) => entry.id)).size, HELP_GUIDE.length);
  for (const entry of HELP_GUIDE) assert.ok(!entry.demo || ["dock", "ghost", "camera", "progress", "mindmap", "tabs", "library", "vocab", "home", "gems", "settings", "report"].includes(entry.demo), entry.id);
});

test("reading screen questions reach the right entries", () => {
  assert.equal(top("What is ghost mode in the reading session?"), "ghost-mode");
  assert.equal(top("What is the use of the Ghost button?"), "ghost-mode");
  assert.equal(top("What is the difference between the live camera and snapshot?"), "camera-options");
  assert.ok(findRelevantHelp("What do all the buttons on the reading screen do?", 2).some((entry) => entry.id === "session-buttons"));
  assert.equal(top("how do i end the session"), "session-end");
  assert.equal(top("What is the chapter progress at the top of the reading screen?"), "session-progress");
});

test("mind map questions reach the detailed mind map entry", () => {
  assert.equal(top("mind map kaise kaam karta hai?"), "mind-map");
  assert.equal(top("do you have any idea about mind map?"), "mind-map");
  assert.equal(top("what are echoes?"), "mind-map");
});

test("other sections are reachable", () => {
  assert.equal(top("How do I save new vocabulary words?"), "vocabulary");
  assert.equal(top("How do I sync my account?"), "account-sync");
  assert.equal(top("How do I change the app theme to dark?"), "settings");
  assert.equal(top("how do I undo the AI rewrite in a report"), "report-issue");
  assert.equal(top("how do I add a book"), "add-book");
});

test("retrieval returns only matching entries and nothing for unrelated text", () => {
  const matches = findRelevantHelp("ghost mode", 3);
  assert.equal(matches[0].id, "ghost-mode");
  assert.ok(matches.every((entry) => entry.score > 0));
  assert.deepEqual(findRelevantHelp("zzz qqq", 3), []);
});

test("privacy question can be answered from the local help guide", () => {
  const answer = getRelevantHelp("What data does Help send to AI?");
  assert.equal(answer?.id, "help-privacy");
  assert.match(answer.content, /never sends your books/i);
});

test("camera and dock answers explain the actual controls", () => {
  const camera = buildShortHelpAnswer(getRelevantHelp("Live camera or snapshot?"));
  assert.match(camera, /\*\*Snap page\*\*/);
  assert.match(camera, /no live camera video/i);
  assert.match(camera, /\*\*Next page\*\*/);
  const buttons = buildShortHelpAnswer(getRelevantHelp("What do the reading buttons do?"));
  assert.match(buttons, /\*\*Mic\*\*/);
  assert.match(buttons, /\*\*Transcript\*\*/);
  assert.match(buttons, /\*\*End session\*\*/);
  assert.match(buttons, /\*\*Tap to ask\*\*/);
});

test("Reader Arena help explains ranking inputs, calculation, refresh, and data flow", () => {
  const answer = getRelevantHelp("How does Reader Arena calculate rankings and refresh its data?");

  assert.equal(answer?.id, "reader-arena");
  assert.match(answer.content, /active-reading time/i);
  assert.match(answer.content, /service-role RPC/i);
  assert.match(answer.content, /equal totals share a rank/i);
  assert.match(answer.content, /does not poll while open/i);
  assert.match(answer.content, /cannot be backfilled/i);
});

test("gem download help describes templates, ratios, effects, and saved choices", () => {
  const answer = getRelevantHelp("How do I choose a gem card template and square post ratio?");

  assert.equal(answer?.id, "gem-detail");
  assert.match(answer.content, /14 layouts/i);
  assert.match(answer.content, /Story.*9:16.*Post.*4:5.*Square.*1:1/);
  assert.match(answer.content, /Surprise me/);
  assert.match(answer.content, /saved on this device/);
});

test("in-chat animation selection explains gem templates and aspect controls", async () => {
  const { pickAnimationsByKeywords } = await import("./helpAnimations.js");
  assert.equal(pickAnimationsByKeywords("How do I choose a gem card template and square aspect ratio?")[0], "gem-download");
  assert.equal(pickAnimationsByKeywords("Where do I copy my UID on Profile?")[0], "prof-card");
});

test("Profile help covers UID copy and sticky reader card behavior", () => {
  const answer = getRelevantHelp("Where can I copy my UID, and why does my profile card stay at the top?");
  assert.equal(answer?.id, "profile");
  assert.match(answer.content, /copy icon/i);
  assert.match(answer.content, /stays at the top/i);
  assert.match(answer.content, /Show my photo in the Arena/);
  assert.match(answer.content, /private storage/i);
});

test("Reader Arena guide documents roster states and deterministic tie order", () => {
  const answer = getRelevantHelp("How does Reader Arena display ties and small rosters?");
  assert.equal(answer?.id, "reader-arena");
  assert.match(answer.content, /stable order by their private Supabase account ID/i);
  assert.match(answer.content, /one reader gets a hero card/i);
  assert.match(answer.content, /two readers get a two-step podium/i);
  assert.match(answer.content, /scrollable list/i);
});

test("limit and update help explain account-aware contact and opt-in deployment pushes", () => {
  const limit = getRelevantHelp("How do I request more reading time and what does the email include?");
  assert.equal(limit?.id, "daily-reading-limit");
  assert.match(limit.content, /pre-filled Gmail request/i);
  assert.match(limit.content, /Supabase UID/i);

  const update = getRelevantHelp("Are production deployment announcement pushes sent automatically to opted-in readers?");
  assert.equal(update?.id, "updates");
  assert.match(update.content, /successful production deployment/i);
  assert.match(update.content, /App updates & announcements/i);
});

test("2.5.0 release lookup names the Gem Studio release", () => {
  const answer = getRelevantHelp("What did version 2.5.0 Every Line, Reimagined add?");

  assert.equal(answer?.id, "release-2-5-0");
  assert.match(answer.content, /Every Line, Reimagined/);
  assert.match(answer.content, /14 distinct quote-card templates/);
});
