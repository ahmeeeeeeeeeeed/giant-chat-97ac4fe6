#!/usr/bin/env node
// Replaces Capacitor's default Android launcher icons with the app's own
// icon (public/icons/icon-512.png) so the installed APK shows the custom
// icon on the user's home screen. Writes the PNG into all mipmap-* density
// folders as ic_launcher.png and ic_launcher_round.png, removes the default
// adaptive XML + webp variants that would otherwise win, and adds a solid
// background color matching the splash/theme.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC_ICON = resolve("public/icons/icon-512.png");
const ANDROID_RES = resolve("android/app/src/main/res");

if (!existsSync(SRC_ICON)) {
  console.log("[patch-android-icon] source icon missing — skipping.");
  process.exit(0);
}
if (!existsSync(ANDROID_RES)) {
  console.log("[patch-android-icon] android/res not found — skipping.");
  process.exit(0);
}

const iconBuf = readFileSync(SRC_ICON);
const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];

for (const d of densities) {
  const dir = join(ANDROID_RES, `mipmap-${d}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Wipe defaults that take priority (webp + adaptive xml).
  for (const f of readdirSync(dir)) {
    if (/^ic_launcher.*\.(webp|xml|png)$/i.test(f)) {
      try { unlinkSync(join(dir, f)); } catch { /* ignore */ }
    }
  }
  writeFileSync(join(dir, "ic_launcher.png"), iconBuf);
  writeFileSync(join(dir, "ic_launcher_round.png"), iconBuf);
  writeFileSync(join(dir, "ic_launcher_foreground.png"), iconBuf);
}

// Remove adaptive icon XMLs in mipmap-anydpi-v26 (would otherwise override the PNGs).
const anyDpi = join(ANDROID_RES, "mipmap-anydpi-v26");
if (existsSync(anyDpi)) {
  for (const f of readdirSync(anyDpi)) {
    if (/^ic_launcher.*\.xml$/i.test(f)) {
      try { unlinkSync(join(anyDpi, f)); } catch { /* ignore */ }
    }
  }
}

// Ensure ic_launcher_background color exists (some default themes reference it).
const valuesDir = join(ANDROID_RES, "values");
if (existsSync(valuesDir)) {
  const colorsPath = join(valuesDir, "ic_launcher_background.xml");
  writeFileSync(
    colorsPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0a1a14</color>\n</resources>\n`,
  );
}

console.log(`[patch-android-icon] launcher icon replaced in ${densities.length} densities (${iconBuf.length} bytes).`);
