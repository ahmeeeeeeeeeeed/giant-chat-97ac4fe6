import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Trash2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getVersionCode, APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/app/admin/updates")({
  component: AdminUpdates,
});

type Row = {
  id: string;
  version: string;
  version_code: number;
  minimum_required_version: string;
  update_message: string;
  update_type: "force" | "optional";
  file_url: string;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
};

function AdminUpdates() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [version, setVersion] = useState("");
  const [minVersion, setMinVersion] = useState("1.0.0");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"force" | "optional">("optional");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(0); // bytes

  useEffect(() => {
    if (loaded && !isAdmin) {
      toast.error("هذه الصفحة للمسؤولين فقط");
      navigate({ to: "/app" });
    }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_updates")
      .select("*")
      .order("version_code", { ascending: false });
    if (error) toast.error(error.message);
    setList((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  if (!loaded || (!isAdmin && loaded)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const handleUpload = async () => {
    if (!file) { toast.error("اختر ملف APK أولاً"); return; }
    if (!/^\d+\.\d+\.\d+$/.test(version)) { toast.error("صيغة الإصدار: 1.2.3"); return; }
    if (!/^\d+\.\d+\.\d+$/.test(minVersion)) { toast.error("صيغة الحد الأدنى: 1.2.3"); return; }
    setBusy(true);
    setProgress(0);
    setUploaded(0);
    try {
      const path = `apk/giant-${version}-${Date.now()}.apk`;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || SUPABASE_KEY;

      // Real upload with progress via XHR (supabase-js doesn't expose progress events)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/app-updates/${encodeURI(path)}`;
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("apikey", SUPABASE_KEY);
        xhr.setRequestHeader("Content-Type", "application/vnd.android.package-archive");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploaded(ev.loaded);
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploaded(file.size);
            setProgress(100);
            resolve();
          } else {
            let msg = `فشل الرفع (${xhr.status})`;
            try { const j = JSON.parse(xhr.responseText); msg = j.message || j.error || msg; } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع"));
        xhr.onabort = () => reject(new Error("تم إلغاء الرفع"));
        xhr.send(file);
      });

      // Create a long-lived signed URL (10 years) so users can download.
      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const { data: signed, error: sErr } = await supabase.storage
        .from("app-updates")
        .createSignedUrl(path, TEN_YEARS);
      if (sErr || !signed?.signedUrl) throw new Error(sErr?.message || "فشل إنشاء رابط التنزيل");

      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("app_updates").insert({
        version,
        version_code: getVersionCode(version),
        minimum_required_version: minVersion,
        minimum_required_code: getVersionCode(minVersion),
        update_message: message,
        update_type: type,
        file_url: signed.signedUrl,
        file_size: file.size,
        created_by: user?.id,
        is_active: true,
      });
      if (insErr) throw new Error(insErr.message);

      toast.success("تم رفع التحديث ونشره");
      setVersion(""); setMessage(""); setFile(null);
      const input = document.getElementById("apk-input") as HTMLInputElement | null;
      if (input) input.value = "";
      void load();
    } catch (e: any) {
      toast.error(e?.message || "فشل الرفع");
    } finally {
      setBusy(false);
      setTimeout(() => { setProgress(0); setUploaded(0); }, 1500);
    }
  };

  const toggleActive = async (row: Row) => {
    const { error } = await supabase.from("app_updates").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error(error.message);
    else void load();
  };

  const remove = async (row: Row) => {
    if (!confirm(`حذف الإصدار ${row.version}؟`)) return;
    const { error } = await supabase.from("app_updates").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); void load(); }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">إدارة التحديثات</h1>
          <p className="text-xs text-muted-foreground">الإصدار الحالي للتطبيق: {APP_VERSION}</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Upload className="h-4 w-4" /> رفع إصدار جديد</h2>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">رقم الإصدار</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.1"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">الحد الأدنى المطلوب</label>
            <input value={minVersion} onChange={(e) => setMinVersion(e.target.value)}
              placeholder="1.0.0"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">رسالة التحديث</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder="ما الجديد في هذا الإصدار..."
            className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">نوع التحديث</label>
          <div className="mt-1 flex gap-2">
            <button onClick={() => setType("optional")}
              className={`flex-1 h-11 rounded-xl border font-semibold text-sm ${type === "optional" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}>
              اختياري
            </button>
            <button onClick={() => setType("force")}
              className={`flex-1 h-11 rounded-xl border font-semibold text-sm ${type === "force" ? "bg-red-500 text-white border-red-500" : "border-border bg-background"}`}>
              إجباري
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">ملف APK</label>
          <input id="apk-input" type="file" accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-semibold" />
          {file && <p className="mt-1 text-xs text-muted-foreground">{file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        </div>

        {(busy || progress > 0) && file && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{(uploaded / 1024 / 1024).toFixed(2)} / {(file.size / 1024 / 1024).toFixed(2)} MB</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        <button onClick={handleUpload} disabled={busy || !file || !version}
          className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {busy ? "جارٍ الرفع..." : "رفع ونشر"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-bold">الإصدارات السابقة</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد إصدارات</p>
        ) : (
          <ul className="space-y-2">
            {list.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${row.update_type === "force" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>
                  {row.update_type === "force" ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">v{row.version} {row.is_active ? "" : "(معطل)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{row.update_message || "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("ar")} • {row.file_size ? (row.file_size / 1024 / 1024).toFixed(1) + " MB" : ""}
                  </div>
                </div>
                <button onClick={() => toggleActive(row)} className="text-xs px-3 h-8 rounded-lg border border-border">
                  {row.is_active ? "تعطيل" : "تفعيل"}
                </button>
                <button onClick={() => remove(row)} className="text-red-500 p-2">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
