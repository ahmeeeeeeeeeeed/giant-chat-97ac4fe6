// Generates dist/client/index.html so Capacitor (Android APK) can package the
// app as a static SPA. TanStack Start is SSR-only and does not emit an
// index.html on its own; this script reads the build manifest to discover the
// hashed client entry chunk + CSS, then writes a minimal HTML shell that
// loads them. The WebView boots the SPA fully client-side — no network
// required after the APK is installed.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const CLIENT_DIR = resolve("dist/client");
const SERVER_DIR = resolve("dist/server");

if (!existsSync(CLIENT_DIR)) {
  console.error(`[capacitor-index] missing ${CLIENT_DIR} — run 'npm run build' first.`);
  process.exit(1);
}

// 1) Locate the tanstack-start manifest (filename has a hash).
const manifestFile = readdirSync(SERVER_DIR).find((f) =>
  f.startsWith("_tanstack-start-manifest_v-") && f.endsWith(".mjs"),
);
if (!manifestFile) {
  console.error("[capacitor-index] tanstack manifest not found in dist/server/.");
  process.exit(1);
}
const manifestSrc = readFileSync(join(SERVER_DIR, manifestFile), "utf8");

// 2) Pull the root preloads array — it contains the client entry chunk.
const rootMatch = manifestSrc.match(/__root__:\s*\{[^}]*?preloads:\s*\[([^\]]+)\]/);
if (!rootMatch) {
  console.error("[capacitor-index] could not parse __root__.preloads from manifest.");
  process.exit(1);
}
const rootPreloads = [...rootMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const entryScript = rootPreloads.find((p) => /\/assets\/index-[^/]+\.js$/.test(p));
if (!entryScript) {
  console.error("[capacitor-index] could not find client entry chunk in root preloads.");
  process.exit(1);
}

// 3) Find the styles CSS chunk in dist/client/assets/.
const assetsDir = join(CLIENT_DIR, "assets");
const cssFile = readdirSync(assetsDir).find((f) => /^styles-.*\.css$/.test(f));
if (!cssFile) {
  console.error("[capacitor-index] styles css not found in dist/client/assets/.");
  process.exit(1);
}
const cssHref = `/assets/${cssFile}`;

// 4) Collect index-route preloads (extra warm chunks) — non-fatal if missing.
const indexMatch = manifestSrc.match(/"\/":\s*\{[^}]*?preloads:\s*\[([^\]]+)\]/);
const indexPreloads = indexMatch
  ? [...indexMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];
const preloadLinks = [...new Set([...rootPreloads, ...indexPreloads])]
  .map((href) => `    <link rel="modulepreload" href="${href}">`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#10b981" />
    <title>Giant — دردشة مجتمعات وغرف</title>
    <meta name="description" content="Giant: غرف دردشة مجتمعات ومحادثات خاصة فورية." />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <link rel="stylesheet" href="${cssHref}" />
${preloadLinks}
    <script type="module" src="${entryScript}"></script>
    <style>
      html, body { margin: 0; padding: 0; background: #0a1a14; color: #e8f7ef; }
    </style>
  </head>
  <body></body>
</html>
`;

writeFileSync(join(CLIENT_DIR, "index.html"), html, "utf8");
console.log(`[capacitor-index] wrote dist/client/index.html (entry=${entryScript}, css=${cssHref})`);
