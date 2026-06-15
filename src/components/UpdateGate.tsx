import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, getVersionCode } from "@/lib/version";
import { downloadAndInstallApk, isForceRequired, isNativeAndroid, type AppUpdateRow } from "@/lib/app-update";
import { Download, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "giant.update.dismissed.v";
const INSTALLED_VERSION_KEY = "giant.update.installed.v";
const INSTALLED_CODE_KEY = "giant.update.installed.code";

function getInstalledCode(): number {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(INSTALLED_CODE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
function markInstalled(version: string, versionCode: number) {
  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, version);
    localStorage.setItem(INSTALLED_CODE_KEY, String(versionCode));
  } catch { /* ignore */ }
}

export function UpdateGate() {
  const [latest, setLatest] = useState<AppUpdateRow | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const onAndroid = await isNativeAndroid();
      if (cancelled) return;
      setNative(onAndroid);
      const { data } = await supabase
        .from("app_updates")
        .select("*")
        .eq("is_active", true)
        .order("version_code", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as AppUpdateRow;
      // Effective installed code = max(APP_VERSION baked at build time,
      // last version the user marked as installed via this gate). This
      // protects against APP_VERSION drift between CI builds.
      const installedCode = Math.max(getVersionCode(APP_VERSION), getInstalledCode());
      if (row.version_code <= installedCode) return;
      setLatest(row);
      const skipped = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
      if (skipped === row.version && !isForceRequired(row)) setDismissed(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!latest || dismissed) return null;
  const force = isForceRequired(latest);

  const handleUpdate = async () => {
    if (!native) {
      // On web (Lovable preview / desktop), just open the file URL.
      // Mark as installed so the banner does not reappear on next load.
      markInstalled(latest.version, latest.version_code);
      window.open(latest.file_url, "_blank");
      setDismissed(true);
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstallApk(latest.file_url, (p) => setProgress(p));
      // Persist immediately — after the OS installer takes over, the user
      // returns to a fresh app process with no in-memory state.
      markInstalled(latest.version, latest.version_code);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "فشل التحديث");
      toast.error(e?.message || "فشل التحديث");
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    if (force) return;
    try { localStorage.setItem(DISMISS_KEY, latest.version); } catch {}
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
              الإصدار {latest.version} • الحالي {APP_VERSION}
            </p>
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
              <span>جارٍ تنزيل التحديث... {progress}%</span>
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
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>اكتمل التحميل — يتم فتح المثبت...</span>
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
              onClick={handleUpdate}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold"
            >
              تثبيت الآن
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
