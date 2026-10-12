import { Analytics } from "@vercel/analytics/react";
import { createRoot } from "react-dom/client";
import "@fontsource/playfair-display/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { warmBackend } from "./api.js";
import "./App.css";
import App from "./App.jsx";
import { friendlyErrorMessage } from "./friendlyErrors.js";
import { notify } from "./notify.js";

warmBackend();

// Keep the app feeling native: no pinch, double-tap or ctrl+wheel zoom.
const blockZoom = (event) => event.preventDefault();
document.addEventListener("gesturestart", blockZoom);
document.addEventListener("gesturechange", blockZoom);
document.addEventListener("touchmove", (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });
document.addEventListener("wheel", (event) => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
});

// Unhandled network failures become a calm message instead of a silent break.
let lastNetworkNotice = 0;
window.addEventListener("unhandledrejection", (event) => {
  const text = String(event.reason?.message || event.reason || "");
  if (!/failed to fetch|networkerror|load failed/i.test(text)) return;
  const now = Date.now();
  if (now - lastNetworkNotice < 15000) return;
  lastNetworkNotice = now;
  notify(friendlyErrorMessage(event.reason), "error", 5000);
});

const root = createRoot(document.getElementById("root"));
if (import.meta.env.DEV && window.location.pathname === "/story-assets") {
	import("./story/StoryAssetGallery.jsx").then(({ default: Gallery }) => root.render(<Gallery />));
} else {
	root.render(
		<>
			<App />
			{import.meta.env.PROD && <Analytics />}
		</>
	);
}