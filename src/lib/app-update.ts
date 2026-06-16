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
const NATIVE_VERSION_KEY = "giant.update.native.v";
const NATIVE_CODE_KEY = "giant.update.native.code";
const WEB_BUNDLE_VERSION_KEY = "web_bundle_version";

function getSafeVersionCode(version?: string | null): number {
  if (!version || version === "builtin") return 0;
  return getVersionCode(version);
}

function readStoredCode(key: string): number {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    return getVersionCode(raw);
  } catch { return 0; }
}

function readStoredValue(key: string): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  } catch { return null; }
}

export function getEffectiveInstalledCode(): number {
  // APP_VERSION is baked into the APK at build time — it's the only reliable
  // source of truth for what's actually installed on the device. The stored
  // INSTALLED_CODE_KEY can become stale (e.g. when a published update row is
  // later edited or replaced), so we ignore it here and only take the higher
  // of APP_VERSION and the last applied OTA web bundle.
  return Math.max(
    getVersionCode(APP_VERSION),
    readStoredCode(NATIVE_CODE_KEY),
    readStoredCode(NATIVE_VERSION_KEY),
    readStoredCode(WEB_BUNDLE_VERSION_KEY),
  );
}

export function getNativeInstalledCode(): number {
  return Math.max(
    getVersionCode(APP_VERSION),
    readStoredCode(NATIVE_CODE_KEY),
    readStoredCode(NATIVE_VERSION_KEY),
  );
}

export function getApkVersionFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const decoded = (() => {
    try { return decodeURIComponent(url); } catch { return url; }
  })();
  return decoded.match(/giant-([0-9]+\.[0-9]+\.[0-9]+)-[^/?]*\.apk/i)?.[1]
    ?? decoded.match(/([0-9]+\.[0-9]+\.[0-9]+)[^/?]*\.apk/i)?.[1]
    ?? null;
}

export function shouldInstallFullApk(latest: Pick<AppUpdateRow, "file_url" | "version_code">): boolean {
  const apkVersion = getApkVersionFromUrl(latest.file_url);
  if (!apkVersion) return false;
  const apkCode = getVersionCode(apkVersion);
  return apkCode > getNativeInstalledCode() && apkCode >= latest.version_code;
}

export function getDisplayInstalledVersion(): string {
  return readStoredValue(WEB_BUNDLE_VERSION_KEY) || readStoredValue(NATIVE_VERSION_KEY) || APP_VERSION;
}

export function getDisplayInstalledCode(): number {
  const displayVersion = getDisplayInstalledVersion();
  return Math.max(getVersionCode(displayVersion), getEffectiveInstalledCode());
}

export function markUpdateInstalled(version: string, versionCode = getVersionCode(version)): void {
  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, version);
    localStorage.setItem(INSTALLED_CODE_KEY, String(versionCode));
  } catch { /* ignore */ }
}

export function markWebBundleInstalled(version: string, versionCode = getVersionCode(version)): void {
  markUpdateInstalled(version, versionCode);
  try { localStorage.setItem(WEB_BUNDLE_VERSION_KEY, version); } catch { /* ignore */ }
}

export async function syncNativeInstalledVersion(): Promise<void> {
  if (!(await isNativeAndroid())) return;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const version = info.version || APP_VERSION;
    const build = String(info.build || "");
    const code = /^\d+$/.test(build) ? parseInt(build, 10) : getVersionCode(version);
    localStorage.setItem(NATIVE_VERSION_KEY, version);
    localStorage.setItem(NATIVE_CODE_KEY, String(code));
  } catch { /* ignore */ }
}

export async function notifyNativeUpdateReady(): Promise<void> {
  if (!(await isNativeAndroid())) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    const ready = await CapacitorUpdater.notifyAppReady();
    let activeVersion = ready?.bundle?.version;
    let nativeVersion: string | null = null;

    // Some Android launches report the ready bundle before local JS storage is
    // hydrated. Read the updater's native source of truth too, so an already
    // applied OTA bundle (e.g. 11.0.0) is never offered again as a new update.
    try {
      const current = await CapacitorUpdater.current();
      nativeVersion = current?.native || null;
      if (current?.bundle?.version && current.bundle.version !== "builtin") {
        activeVersion = current.bundle.version;
      }
    } catch { /* ignore */ }

    if (nativeVersion) {
      localStorage.setItem(NATIVE_VERSION_KEY, nativeVersion);
      localStorage.setItem(NATIVE_CODE_KEY, String(getVersionCode(nativeVersion)));
    }

    // After a full APK install, Android may still have an older OTA bundle cached.
    // If that happens, reset to the APK-bundled web code so the app actually opens
    // on the newly installed version instead of the previous web bundle.
    if (
      activeVersion && activeVersion !== "builtin" && nativeVersion &&
      getSafeVersionCode(activeVersion) < getSafeVersionCode(nativeVersion)
    ) {
      localStorage.removeItem(WEB_BUNDLE_VERSION_KEY);
      localStorage.removeItem(INSTALLED_VERSION_KEY);
      localStorage.removeItem(INSTALLED_CODE_KEY);
      await CapacitorUpdater.reset({ toLastSuccessful: false });
      return;
    }

    if (activeVersion && activeVersion !== "builtin") {
      localStorage.setItem(WEB_BUNDLE_VERSION_KEY, activeVersion);
      localStorage.setItem(INSTALLED_VERSION_KEY, activeVersion);
      localStorage.setItem(INSTALLED_CODE_KEY, String(getVersionCode(activeVersion)));
    }
  } catch { /* ignore */ }
}

export function isNewerVersion(latestCode: number): boolean {
  return latestCode > getEffectiveInstalledCode();
}

export function isUpdateAlreadyMarked(latest: Pick<AppUpdateRow, "version" | "version_code">): boolean {
  const webVersion = readStoredValue(WEB_BUNDLE_VERSION_KEY);
  return webVersion === latest.version || getVersionCode(webVersion || "0.0.0") === latest.version_code;
}

export function shouldShowUpdate(latest: Pick<AppUpdateRow, "version" | "version_code"> & Partial<Pick<AppUpdateRow, "file_url" | "web_bundle_url" | "web_bundle_version">>): boolean {
  if ("file_url" in latest && shouldInstallFullApk(latest as Pick<AppUpdateRow, "file_url" | "version_code">)) return true;
  if (isUpdateAlreadyMarked(latest)) return false;
  if (latest.web_bundle_url) {
    const bundleVersion = latest.web_bundle_version || latest.version;
    const bundleCode = getVersionCode(bundleVersion);
    if (bundleCode >= getEffectiveInstalledCode()) return true;
  }
  return latest.version_code > getEffectiveInstalledCode();
}

export function isForceRequired(latest: AppUpdateRow): boolean {
  if (shouldInstallFullApk(latest)) return latest.update_type === "force" || getNativeInstalledCode() < latest.minimum_required_code;
  if (isUpdateAlreadyMarked(latest)) return false;
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
  onReadyToInstall?: () => void,
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
  onReadyToInstall?.();

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
      // set() immediately destroys the JS context and reloads the app, so no
      // caller code after await applyWebBundleUpdate() is guaranteed to run.
      // Persist the applied web version before switching bundles to prevent the
      // same update prompt from appearing again on the next launch.
      markWebBundleInstalled(version);
      await CapacitorUpdater.set({ id: bundle.id });
      onProgress(100);
      await CapacitorUpdater.reload();
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
