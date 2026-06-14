// Single source of truth for the app version. Synced from package.json at
// build time and patched into AndroidManifest as versionName/versionCode by
// scripts/patch-android-version.mjs during the APK build workflow.
import pkg from "../../package.json";

export const APP_VERSION: string = (pkg as { version?: string }).version ?? "1.0.0";

// Numeric build code (Android versionCode). Derived from semver: MAJOR*10000 + MINOR*100 + PATCH.
export function getVersionCode(v: string = APP_VERSION): number {
  const [maj = 0, min = 0, pat = 0] = v.split(".").map((n) => parseInt(n, 10) || 0);
  return maj * 10000 + min * 100 + pat;
}
