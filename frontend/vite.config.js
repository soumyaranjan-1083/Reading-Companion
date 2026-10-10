import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineConfig, normalizePath } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const require = createRequire(import.meta.url);
const vadDist = dirname(require.resolve("@ricky0123/vad-web"));
const onnxDist = dirname(require.resolve("onnxruntime-web"));

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    viteStaticCopy({
      targets: [
        { src: normalizePath(resolve(vadDist, "vad.worklet.bundle.min.js")), dest: "vad" },
        { src: normalizePath(resolve(vadDist, "silero_vad_v5.onnx")), dest: "vad" },
        { src: normalizePath(resolve(onnxDist, "ort-wasm-simd-threaded.wasm")), dest: "vad" },
        { src: normalizePath(resolve(onnxDist, "ort-wasm-simd-threaded.mjs")), dest: "vad" },
      ],
    }),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Reading Companion",
        short_name: "Reading",
        description: "A friend who reads with you.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0A0B14",
        theme_color: "#0A0B14",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["push-sw.js"],
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/vad/**"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DOCS_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    __DOCS_COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7)),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});