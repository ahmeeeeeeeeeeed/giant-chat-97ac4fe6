// Verifies dist/client/index.html exists after `vite build`.
// TanStack Start's SPA mode (vite.config.ts → tanstackStart.spa) prerenders
// a real hydratable HTML shell to dist/client/index.html. If for any reason
// it's missing, this script fails loudly so the APK build doesn't ship a
// broken APK. We intentionally do NOT hand-roll the shell anymore —
// hand-rolled HTML doesn't match the React tree the client tries to hydrate
// and produces a blank screen on launch.

import { existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const CLIENT_DIR = resolve("dist/client");
const INDEX_HTML = join(CLIENT_DIR, "index.html");

function die(msg) {
  console.error(`[capacitor-index] ${msg}`);
  process.exit(1);
}

if (!existsSync(CLIENT_DIR)) die(`missing ${CLIENT_DIR} — run 'npm run build' first.`);
if (!existsSync(INDEX_HTML)) {
  die(
    `missing ${INDEX_HTML} — TanStack Start SPA prerender did not emit index.html. ` +
      `Check vite.config.ts → tanstackStart.spa is enabled.`,
  );
}
const size = statSync(INDEX_HTML).size;
if (size < 200) die(`${INDEX_HTML} is suspiciously small (${size} bytes).`);

console.log(`[capacitor-index] ok — ${INDEX_HTML} (${size} bytes)`);
