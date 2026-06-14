#!/usr/bin/env node
// Injects required Android permissions into AndroidManifest.xml after
// `npx cap add android` / `npx cap sync android`. Idempotent — safe to run
// every build. Adds permissions for:
//   - INTERNET / network state (Capacitor default, kept explicit)
//   - Notifications (POST_NOTIFICATIONS on Android 13+) + FCM/push receive
//   - Microphone (RECORD_AUDIO) for getUserMedia voice
//   - Camera (CAMERA) for photo/video capture
//   - Media access for image/video pickers (Android 13+ scoped + legacy)
//   - Vibration for notification feedback
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  console.log("[patch-android] AndroidManifest.xml not found — skipping.");
  process.exit(0);
}

const REQUIRED = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.VIBRATE",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.CAMERA",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.REQUEST_INSTALL_PACKAGES",
];

const FEATURES = [
  { name: "android.hardware.camera", required: "false" },
  { name: "android.hardware.camera.autofocus", required: "false" },
  { name: "android.hardware.microphone", required: "false" },
];

let xml = readFileSync(manifestPath, "utf8");

let added = 0;
for (const perm of REQUIRED) {
  if (!xml.includes(`android:name="${perm}"`)) {
    const line = `    <uses-permission android:name="${perm}" />\n`;
    xml = xml.replace(/<manifest([^>]*)>\s*/, (m) => m + line);
    added++;
  }
}

for (const f of FEATURES) {
  if (!xml.includes(`uses-feature`) || !xml.includes(`android:name="${f.name}"`)) {
    const line = `    <uses-feature android:name="${f.name}" android:required="${f.required}" />\n`;
    xml = xml.replace(/<manifest([^>]*)>\s*/, (m) => m + line);
    added++;
  }
}

writeFileSync(manifestPath, xml);
console.log(`[patch-android] AndroidManifest.xml patched (+${added} entries).`);
