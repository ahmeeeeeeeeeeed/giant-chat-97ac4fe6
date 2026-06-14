// Generates dist/client/index.html so Capacitor (Android APK) can package the
// app as a static SPA. TanStack Start is SSR-only and does not emit an
// index.html on its own; this script discovers the hashed client entry chunk
// + styles CSS from the build output and writes a minimal HTML shell that
// loads them. The WebView boots the SPA fully client-side — no network
// required after the APK is installed.
//
// Resilient lookup order for the entry chunk:
//   1. tanstack-start manifest (`_tanstack-start-manifest_v-*.mjs`), found by
//      walking `dist/` recursively — output layout differs between Cloudflare
//      / Node / Vercel presets, so we don't hard-code `dist/server/`.
//   2. Vite client manifest at `dist/client/.vite/manifest.json`.
//   3. Heuristic scan of `dist/client/assets/index-*.js` — pick the chunk that
//      pulls in the largest dependency tree (the SPA bootstrap).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const CLIENT_DIR = resolve("dist/client");
const DIST_DIR = resolve("dist");

function die(msg) {
  console.error(`[capacitor-index] ${msg}`);
  process.exit(1);
}

if (!existsSync(CLIENT_DIR)) die(`missing ${CLIENT_DIR} — run 'npm run build' first.`);
const assetsDir = join(CLIENT_DIR, "assets");
if (!existsSync(assetsDir)) die(`missing ${assetsDir} — build did not emit client assets.`);

// ---------------------------------------------------------------------------
// Locate entry script
// ---------------------------------------------------------------------------

/** Recursively walk a directory and yield matching file paths. */
function* walk(dir, predicate, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      yield* walk(full, predicate, depth + 1);
    } else if (predicate(name, full)) {
      yield full;
    }
  }
}

function fromTanstackManifest() {
  const hits = [
    ...walk(DIST_DIR, (n) => n.startsWith("_tanstack-start-manifest_v-") && n.endsWith(".mjs")),
  ];
  if (hits.length === 0) return null;
  const src = readFileSync(hits[0], "utf8");
  const rootMatch = src.match(/__root__:\s*\{[^}]*?preloads:\s*\[([^\]]+)\]/);
  if (!rootMatch) return null;
  const preloads = [...rootMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const entry = preloads.find((p) => /\/assets\/index-[^/]+\.js$/.test(p));
  if (!entry) return null;
  const indexMatch = src.match(/"\/":\s*\{[^}]*?preloads:\s*\[([^\]]+)\]/);
  const indexPreloads = indexMatch
    ? [...indexMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    : [];
  return { entry, preloads: [...new Set([...preloads, ...indexPreloads])], source: hits[0] };
}

function fromViteManifest() {
  const candidates = [
    join(CLIENT_DIR, ".vite/manifest.json"),
    join(CLIENT_DIR, "manifest.json"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const json = JSON.parse(readFileSync(p, "utf8"));
      const entry = Object.values(json).find((v) => v && v.isEntry);
      if (entry && entry.file) {
        return { entry: `/${entry.file}`, preloads: [`/${entry.file}`], source: p };
      }
    } catch { /* ignore */ }
  }
  return null;
}

function fromAssetsHeuristic() {
  const indexChunks = readdirSync(assetsDir).filter((f) => /^index-[^/]+\.js$/.test(f));
  if (indexChunks.length === 0) return null;
  // Pick the chunk with the largest dependency map (the SPA bootstrap embeds
  // a __vite__mapDeps array referencing every lazy route chunk).
  let best = null;
  for (const file of indexChunks) {
    const src = readFileSync(join(assetsDir, file), "utf8");
    const depMatch = src.match(/__vite__mapDeps[\s\S]{0,200}\[([^\]]+)\]/);
    const depCount = depMatch ? (depMatch[1].match(/"/g) || []).length / 2 : 0;
    if (!best || depCount > best.depCount) {
      best = { file, depCount };
    }
  }
  if (!best) return null;
  return {
    entry: `/assets/${best.file}`,
    preloads: [`/assets/${best.file}`],
    source: `heuristic (${best.file}, ${best.depCount} deps)`,
  };
}

const resolved =
  fromTanstackManifest() ?? fromViteManifest() ?? fromAssetsHeuristic();
if (!resolved) {
  die(
    "could not resolve client entry — checked tanstack manifest, vite manifest, " +
      "and assets/index-*.js heuristic. Build output structure may have changed.",
  );
}

// ---------------------------------------------------------------------------
// Locate styles CSS
// ---------------------------------------------------------------------------
const cssFile =
  readdirSync(assetsDir).find((f) => /^styles-.*\.css$/.test(f)) ??
  readdirSync(assetsDir).find((f) => f.endsWith(".css"));
if (!cssFile) die(`no css file found in ${assetsDir}.`);
const cssHref = `/assets/${cssFile}`;

// ---------------------------------------------------------------------------
// Write index.html
// ---------------------------------------------------------------------------
const preloadLinks = resolved.preloads
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
    <script type="module" src="${resolved.entry}"></script>
    <style>
      html, body { margin: 0; padding: 0; background: #0a1a14; color: #e8f7ef; }
    </style>
  </head>
  <body></body>
</html>
`;

writeFileSync(join(CLIENT_DIR, "index.html"), html, "utf8");
console.log(
  `[capacitor-index] wrote dist/client/index.html (entry=${resolved.entry}, css=${cssHref}, source=${resolved.source})`,
);
