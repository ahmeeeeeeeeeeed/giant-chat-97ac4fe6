// Single source of truth for the app version. The value is injected at
// build time by vite.config.ts (`define: { __APP_VERSION__: ... }`) which
// reads it from package.json. The CI workflow bumps package.json on every
// build via scripts/bump-version.mjs and then patches the same value into
// AndroidManifest as versionName/versionCode.
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";

// Numeric build code (Android versionCode): MAJOR*10000 + MINOR*100 + PATCH.
export function getVersionCode(v: string = APP_VERSION): number {
  const [maj = 0, min = 0, pat = 0] = v.split(".").map((n) => parseInt(n, 10) || 0);
  return maj * 10000 + min * 100 + pat;
}
