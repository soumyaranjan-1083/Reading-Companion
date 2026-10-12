import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./App.css", import.meta.url), "utf8");
const navigation = app.slice(app.indexOf("function BottomNav"), app.indexOf("// ==================== NEW BOOK MODAL"));

test("bottom navigation preserves the pre-v3 destinations, icons, avatar, and active state", () => {
  for (const snippet of [
    '{ id: "dashboard", Icon: Home, label: "Home" }',
    '{ id: "library", Icon: LibraryIcon, label: "Library" }',
    '{ id: "gems", Icon: Gem, label: "Gems" }',
    '{ id: "memory", Icon: Brain, label: "Memory" }',
    'className={`nav-item ${active === "profile" ? "active" : ""}`}',
    '<span className="nav-avatar">{renderAvatar(22)}</span>',
    'className="bottom-nav-shell"',
    'className="bottom-nav elevated"',
  ]) assert.ok(navigation.includes(snippet), snippet);
  assert.doesNotMatch(navigation, /InkIcon/);
  assert.match(css, /\.bottom-nav-shell\s*\{[^}]*left:\s*0; right:\s*0; bottom:\s*0/);
  assert.match(css, /\.bottom-nav\s*\{[^}]*height:\s*72px/);
  assert.doesNotMatch(css, /\.nav-item::before/);
});
