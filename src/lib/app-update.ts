// Helpers for comparing semantic versions and downloading/installing APK updates.
import { APP_VERSION, getVersionCode } from "@/lib/version";

export type AppUpdateRow = {
  id: string;
  version: string;
  version_code: number;
  minimum_required_version: string;
  minimum_required_code: number;
  update_message: string;
  update_type: "force" | "optional";
  file_url: string;
  web_bundle_url?: string | null;
  web_bundle_version?: string | null;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
};

const INSTALLED_VERSION_KEY = "giant.update.installed.v";
const INSTALLED_CODE_KEY = "giant.update.installed.code";
const WEB_BUNDLE_VERSION_KEY = "web_bundle_version";

function readStoredCode(key: string): number {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    return getVersionCode(raw);
  } catch { return 0; }
}

export function getEffectiveInstalledCode(): number {
  return Math.max(
    getVersionCode(APP_VERSION),
    readStoredCode(INSTALLED_CODE_KEY),
    readStoredCode(WEB_BUNDLE_VERSION_KEY),
  );
}

export function markUpdateInstalled(version: string, versionCode = getVersionCode(version)): void {
  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, version);
    localStorage.setItem(INSTALLED_CODE_KEY, String(versionCode));
    localStorage.setItem(WEB_BUNDLE_VERSION_KEY, version);
  } catch { /* ignore */ }
}

export function isNewerVersion(latestCode: number): boolean {
  return latestCode > getEffectiveInstalledCode();
}

export function isForceRequired(latest: AppUpdateRow): boolean {
  const current = getEffectiveInstalledCode();
  if (latest.update_type === "force" && latest.version_code > current) return true;
  // Also force if installed version is below the minimum required.
  if (current < latest.minimum_required_code) return true;
  return false;
}

// True only when running inside Capacitor native (Android APK).
export async function isNativeAndroid(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

// Downloads the APK with a real progress callback, saves it to cache,
// and opens Android's package installer.
export async function downloadAndInstallApk(
  url: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const filename = `giant-update-${Date.now()}.apk`;

  // Fetch with progress via streaming Response body.
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`فشل التحميل (${res.status})`);
  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)));
    }
  }
  // Combine into a single Uint8Array
  const blob = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { blob.set(c, offset); offset += c.length; }

  // Convert to base64
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < blob.length; i += CHUNK) {
    binary += String.fromCharCode(...blob.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary);

  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  onProgress(100);

  // Open the APK with the system installer
  try {
    const mod = await import("@capacitor-community/file-opener");
    const FileOpener = (mod as any).FileOpener;
    await FileOpener.open({
      filePath: written.uri,
      contentType: "application/vnd.android.package-archive",
      openWithDefault: true,
    });
  } catch (e) {
    throw new Error("تعذر فتح المثبت — تأكد من السماح بتثبيت التطبيقات من مصادر غير معروفة");
  }
}

// --------- In-place (OTA) web bundle update ---------
// Updates only the web layer (HTML/JS/CSS/assets) inside the existing APK,
// without requiring the user to reinstall the full app.
// Uses @capgo/capacitor-updater on Android; falls back to a soft cache
// purge + reload in the browser/PWA.

export async function applyWebBundleUpdate(
  bundleUrl: string,
  version: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  if (await isNativeAndroid()) {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    // Listen for download progress (best-effort; not all versions emit it).
    let removeListener: (() => Promise<void>) | null = null;
    try {
      const handle = await (CapacitorUpdater as any).addListener?.(
        "download",
        (info: { percent?: number }) => {
          if (typeof info?.percent === "number") onProgress(Math.max(1, Math.min(99, info.percent)));
        },
      );
      if (handle && typeof handle.remove === "function") removeListener = () => handle.remove();
    } catch { /* ignore */ }

    try {
      onProgress(1);
      const bundle = await CapacitorUpdater.download({ url: bundleUrl, version });
      onProgress(99);
      await CapacitorUpdater.set({ id: bundle.id });
      onProgress(100);
      // CapacitorUpdater.set() automatically reloads the WebView with the new bundle.
    } finally {
      if (removeListener) await removeListener().catch(() => {});
    }
    return;
  }

  // Web / PWA fallback: clear caches + unregister SW + hard reload.
  onProgress(10);
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  onProgress(60);
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* ignore */ }
  onProgress(95);
  try { localStorage.setItem(WEB_BUNDLE_VERSION_KEY, version); } catch { /* ignore */ }
  onProgress(100);
  // small delay so the user sees 100%
  await new Promise((r) => setTimeout(r, 250));
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}
