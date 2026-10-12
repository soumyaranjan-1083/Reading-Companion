import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getHomePreviewSnapshot, loadHomePreview, saveHomePreview, subscribeHomePreview } from "./inkMotion.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("Home preview toggles notify Home immediately and persist both ON and OFF", () => {
  const storage = memoryStorage();
  const states = [];
  const unsubscribe = subscribeHomePreview(() => states.push(getHomePreviewSnapshot()));
  try {
    saveHomePreview(true, storage);
    assert.equal(getHomePreviewSnapshot(), true);
    assert.equal(loadHomePreview(storage), true);
    saveHomePreview(false, storage);
    assert.equal(getHomePreviewSnapshot(), false);
    assert.equal(loadHomePreview(storage), false);
    assert.deepEqual(states, [true, false]);
  } finally {
    unsubscribe();
    saveHomePreview(false, storage);
  }
});

test("Dashboard selects the lazy desk preview when enabled and preserves the original dashboard otherwise", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const dashboard = app.slice(app.indexOf("function DashboardScreen"), app.indexOf("// ==================== LIBRARY"));
  assert.match(app, /const HomePreview = lazy\(\(\) => import\("\.\/HomePreview\.jsx"\)\)/);
  assert.match(dashboard, /useSyncExternalStore\(subscribeHomePreview, getHomePreviewSnapshot/);
  const previewBranch = dashboard.indexOf("if (homePreview)");
  const originalBranch = dashboard.indexOf('<div className="screen dashboard-screen">', previewBranch);
  assert.ok(previewBranch >= 0 && originalBranch > previewBranch);
  assert.match(dashboard.slice(previewBranch, originalBranch), /<HomePreview/);
  assert.match(dashboard.slice(originalBranch), /<StreakHero \/>/);
});
