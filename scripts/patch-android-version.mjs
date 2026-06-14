#!/usr/bin/env node
// Patches android/app/build.gradle's versionCode and versionName to match
// the version in package.json. Run after `npx cap sync android` so Capacitor's
// generated gradle gets the right values. Idempotent.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const version = pkg.version || "1.0.0";
const [maj = 0, min = 0, pat = 0] = version.split(".").map((n) => parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;

const gradlePath = resolve("android/app/build.gradle");
if (!existsSync(gradlePath)) {
  console.log("[patch-android-version] build.gradle not found — skipping.");
  process.exit(0);
}
let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);
console.log(`[patch-android-version] versionCode=${versionCode} versionName=${version}`);
