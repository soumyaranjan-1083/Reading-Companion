import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync(new URL("./SettingsScreens.jsx", import.meta.url), "utf8");
const primitives = readFileSync(new URL("./InkPrimitives.jsx", import.meta.url), "utf8");
const component = settings.slice(settings.indexOf("export function SettingsScreen"), settings.indexOf("export { AboutScreen }"));

test("Settings keeps all original sections, goal values, nine voices, and voice preview actions", () => {
  for (const section of ["You & your companion", "Appearance", "Voice", "Notifications", "Privacy & storage", "Deleted books", "Reading limit", "Backup", "App", "Danger zone"]) assert.ok(component.includes(`title="${section}"`), section);
  assert.match(settings, /const VOICES = \["Leda", "Aoede", "Kore", "Despina", "Erinome", "Sulafat", "Achernar", "Charon", "Orus"\]/);
  assert.match(settings, /const GOALS = \["10 min", "20 min", "30 min", "1 hour"\]/);
  assert.match(component, /Preview this voice/);
  assert.match(component, /Applies from your next session/);
  assert.match(component, /profile\.setVoice|save\("voice", v\)/);
  assert.match(component, /save\("dailyGoal", goal\)/);
});

test("theme, toggles, backup, update, developer contact, deleted books, and release history stay wired", () => {
  for (const snippet of ["setTheme(theme === \"light\" ? \"dark\" : \"light\", event)", "updatePushPref(\"announcements\"", "updatePushPref(\"reminders\"", "updateArenaPhotoPreference", "Export backup", "Restore", "checkUpdate", "openDeveloperEmail(\"limit_increase\"", "restoreBook(book)", "permanentlyDeleteBook(book)", "setReleaseNotesOpen(true)"]) assert.ok(component.includes(snippet), snippet);
  assert.match(component, /InkConfirmationSheet/);
  assert.match(component, /window\.startViewTransition|document\.startViewTransition/);
  assert.match(component, /role="switch" aria-label="Theme" aria-checked=\{theme === "light"\}/);
});

test("Settings title follows its own scroller and chapter markers reveal once", () => {
  assert.match(component, /onScroll=\{\(event\) => setTitleCompact\(event\.currentTarget\.scrollTop > 42\)\}/);
  assert.match(settings, /new IntersectionObserver\(\(\[entry\]\)/);
  assert.match(settings, /section\.classList\.add\("is-revealed"\)/);
  assert.doesNotMatch(component, /window\.addEventListener\("scroll", update/);
});

test("original destructive warning text is retained in the press-and-hold confirmation requests", () => {
  for (const message of ["Clear the saved conversation recaps for all books?", "Delete all saved preferences?", "Delete ALL saved gems? This cannot be undone.", "Delete EVERYTHING (books, gems, memory, profile)? This cannot be undone."]) assert.ok(component.includes(message), message);
  assert.match(primitives, /<InkHoldConfirmButton/);
});
