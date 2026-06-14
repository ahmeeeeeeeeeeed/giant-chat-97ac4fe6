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
  file_size: number | null;
  is_active: boolean;
  created_at: string;
};

export function isNewerVersion(latestCode: number): boolean {
  return latestCode > getVersionCode(APP_VERSION);
}

export function isForceRequired(latest: AppUpdateRow): boolean {
  const current = getVersionCode(APP_VERSION);
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
