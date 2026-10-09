import test from "node:test";
import assert from "node:assert/strict";
import { READER_PROFILE, SNAPSHOT_READER_PROFILE } from "./persona.js";

test("snapshot prompt retains reading tools and continuity without live-camera claims", () => {
  assert.match(SNAPSHOT_READER_PROFILE, /set_current_chapter/);
  assert.match(SNAPSHOT_READER_PROFILE, /SESSION CONTINUITY/);
  assert.match(SNAPSHOT_READER_PROFILE, /GHOST MODE/);
  assert.match(SNAPSHOT_READER_PROFILE, /latest still photo/);
  assert.doesNotMatch(SNAPSHOT_READER_PROFILE, /one camera picture per second|open\/show the book camera|mic is live/i);
  assert.match(READER_PROFILE, /one camera picture per second/);
});

test("both reader persona variants include the overriding grounding protocol", () => {
  for (const profile of [READER_PROFILE, SNAPSHOT_READER_PROFILE]) {
    assert.match(profile, /GROUNDING PROTOCOL - THIS OVERRIDES EVERY OTHER INSTRUCTION/);
    assert.match(profile, /If PAGE_STATUS is not verified_book_page, never claim to see, read, or quote/);
    assert.match(profile, /Do not agree with leading questions/);
    assert.match(profile, /Never fabricate a chapter title, plot, or page number for a placeholder chapter/);
  }
});
