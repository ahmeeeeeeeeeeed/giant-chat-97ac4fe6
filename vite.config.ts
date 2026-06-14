// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version?: string };
const APP_VERSION = pkg.version ?? "1.0.0";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Prerender critical shell pages so dist/client contains real index.html files.
    // Capacitor (Android APK) requires dist/client/index.html to package the WebView;
    // the PWA Service Worker also needs an HTML file for `navigateFallback: "/offline"`.
    prerender: {
      enabled: true,
      crawlLinks: false,
      autoSubfolderIndex: false,
    },
    pages: [
      { path: "/" },
      { path: "/offline" },
      { path: "/login" },
      { path: "/register" },
    ],
  },
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "Giant — دردشة مجتمعات وغرف",
          short_name: "Giant",
          description: "Giant: غرف دردشة مجتمعات ومحادثات خاصة فورية.",
          lang: "ar",
          dir: "rtl",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#0a1a14",
          theme_color: "#10b981",
          icons: [
            { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: "/offline",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/assets\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff,woff2,ttf,otf}"],
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          runtimeCaching: [
            {
              // Cache every visited page. When offline, return the exact cached
              // page the user last visited instead of falling back to /offline.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "giant-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                matchOptions: { ignoreSearch: false },
                plugins: [],
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?|ttf|otf)$/i.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "giant-static",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "giant-images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Cache Lovable CDN assets (videos, large media). The welcome
              // screen background video lives here — caching it makes the
              // splash play offline inside the APK after the first launch.
              urlPattern: ({ url }) => url.pathname.startsWith("/__l5e/assets-v1/"),
              handler: "CacheFirst",
              options: {
                cacheName: "giant-cdn-assets",
                rangeRequests: true,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200, 206] },
              },
            },
            {
              // Generic video fallback (mp4/webm/mov) — same-origin or remote.
              urlPattern: ({ request }) => request.destination === "video",
              handler: "CacheFirst",
              options: {
                cacheName: "giant-videos",
                rangeRequests: true,
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200, 206] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
