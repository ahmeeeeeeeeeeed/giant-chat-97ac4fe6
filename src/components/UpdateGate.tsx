import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/version";
import { applyWebBundleUpdate, clearRememberedDownloadedApk, downloadAndInstallApk, getDisplayInstalledVersion, getRememberedDownloadedApk, isForceRequired, isNativeAndroid, markUpdateInstalled, notifyNativeUpdateReady, openDownloadedApk, shouldInstallFullApk, shouldShowUpdate, syncNativeInstalledVersion, type AppUpdateRow } from "@/lib/app-update";
import { Download, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "giant.update.dismissed.v";

declare const __CAPACITOR_BUILD__: boolean | undefined;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function UpdateGate() {
  const isNativeApp = typeof __CAPACITOR_BUILD__ !== "undefined" && __CAPACITOR_BUILD__;
  if (!isNativeApp) return null;

  const [latest, setLatest] = useState<AppUpdateRow | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  const [downloadedApkPath, setDownloadedApkPath] = useState<string | null>(null);
  const [waitingForInstall, setWaitingForInstall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const onAndroid = await isNativeAndroid();
        if (cancelled) return;
        setNative(onAndroid);
        await notifyNativeUpdateReady();
        await syncNativeInstalledVersion();
        if (cancelled) return;
        const { data } = await supabase
          .from("app_updates")
          .select("*")
          .eq("is_active", true)
          .order("version_code", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as AppUpdateRow;
        if (!shouldShowUpdate(row)) return;
        setLatest(row);
        const savedApk = getRememberedDownloadedApk(row.file_url);
        if (savedApk && shouldInstallFullApk(row)) {
          setDownloadedApkPath(savedApk);
          setDone(true);
          setWaitingForInstall(false);
          setProgress(100);
        }
        const skipped = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
        if (skipped === row.version && !isForceRequired(row)) setDismissed(true);
      } catch {
        // Offline / reconnect race — do not show a red error toast.
      }
    })();

    // When the user returns from Android's installer, re-check the installed
    // version. If the APK was installed successfully, the dialog auto-closes.
    let removeResume: (() => void) | null = null;
    (async () => {
      if (!(await isNativeAndroid())) return;
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("resume", async () => {
          await syncNativeInstalledVersion();
          setLatest((current) => {
            if (current && !shouldShowUpdate(current)) {
              clearRememberedDownloadedApk();
              setDismissed(true);
              setDone(false);
              setBusy(false);
            }
            return current;
          });
        });
        removeResume = () => { handle.remove(); };
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; if (removeResume) removeResume(); };
  }, []);

  if (!latest || dismissed) return null;
  const force = isForceRequired(latest);
  const currentVersion = getDisplayInstalledVersion();
  const needsFullApk = shouldInstallFullApk(latest);

  const handleUpdate = async () => {
    if (needsFullApk && downloadedApkPath) return void handleOpenInstaller();
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      if (needsFullApk) {
        if (!native) {
          window.open(latest.file_url, "_blank");
          return;
        }
        const result = await downloadAndInstallApk(
          latest.file_url,
          (p) => setProgress(p),
        );
        setDownloadedApkPath(result.filePath);
        setWaitingForInstall(result.installerOpened);
        setDone(true);
        return;
      }
      if (latest.web_bundle_url) {
        await applyWebBundleUpdate(
          latest.web_bundle_url,
          latest.web_bundle_version || latest.version,
          (p) => setProgress(p),
        );
        setDone(true);
        return;
      }
      if (!native) {
        window.open(latest.file_url, "_blank");
        markUpdateInstalled(latest.version, latest.version_code);
        setDismissed(true);
        return;
      }
      const result = await downloadAndInstallApk(
        latest.file_url,
        (p) => setProgress(p),
      );
      setDownloadedApkPath(result.filePath);
      setWaitingForInstall(result.installerOpened);
      setDone(true);
    } catch (e) {
      const message = errorMessage(e, "فشل التحديث");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenInstaller = async () => {
    if (!downloadedApkPath) return void handleUpdate();
    setBusy(true);
    setError(null);
    try {
      await openDownloadedApk(downloadedApkPath);
      setWaitingForInstall(true);
    } catch (e) {
      const message = errorMessage(e, "تعذر فتح المثبت");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    if (force) return;
    try { localStorage.setItem(DISMISS_KEY, latest.version); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${force ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>
            {force ? <AlertTriangle className="h-6 w-6" /> : <Download className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">
              {force ? "تحديث إجباري" : "تحديث جديد متاح"}
            </h2>
            <p className="text-xs text-muted-foreground">
              الإصدار {latest.version} • الحالي {currentVersion || APP_VERSION}
            </p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${needsFullApk ? "bg-sky-500/15 text-sky-600" : "bg-emerald-500/15 text-emerald-600"}`}>
              {needsFullApk ? "تثبيت كامل (APK)" : "تحديث داخلي تلقائي"}
            </span>
          </div>
          {!force && !busy && !done && (
            <button onClick={handleLater} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {latest.update_message && (
          <div className="mb-4 rounded-2xl bg-secondary/40 p-3 text-sm whitespace-pre-wrap leading-relaxed">
            {latest.update_message}
          </div>
        )}

        {busy && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{latest.web_bundle_url && !needsFullApk ? "جارٍ تطبيق التحديث" : "جارٍ تنزيل التحديث"}... {progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {done && (
          <div className="mb-4 space-y-3 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">
                {latest.web_bundle_url && !needsFullApk
                  ? "تم تطبيق التحديث — سيتم إعادة تشغيل التطبيق"
                  : waitingForInstall ? "تم فتح المثبّت — أكمل التثبيت من نافذة Android" : "اكتمل التحميل — افتح المثبّت"}
              </span>
            </div>
            {(!latest.web_bundle_url || needsFullApk) && (
              <>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
                  <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-emerald-500" />
                </div>
                <ol className="list-decimal space-y-1 pr-5 text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-300/90">
                  <li>اضغط "فتح المثبّت" إذا لم تظهر نافذة Android تلقائيًا.</li>
                  <li>في نافذة Android اضغط "تثبيت" ثم انتظر حتى تنتهي.</li>
                  <li>إذا ظهرت رسالة "مصادر غير معروفة" فعّل الإذن ثم أعد المحاولة.</li>
                  <li>بعد انتهاء التثبيت اضغط "فتح" لتشغيل النسخة الجديدة.</li>
                </ol>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
        )}

        <div className="flex gap-2">
          {!done && (
            <button
              onClick={handleUpdate}
              disabled={busy}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {busy ? "جارٍ التحميل" : "تحديث الآن"}
            </button>
          )}
          {done && (
            <button
              onClick={handleOpenInstaller}
              disabled={busy}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
            >
              {busy ? "جارٍ فتح المثبت" : "فتح المثبّت"}
            </button>
          )}
          {!force && !busy && !done && (
            <button
              onClick={handleLater}
              className="h-12 px-5 rounded-2xl border border-border font-semibold"
            >
              لاحقًا
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
