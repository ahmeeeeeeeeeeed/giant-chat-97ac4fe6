import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { invalidateStoryCache, fetchActiveStories } from "@/lib/use-stories";
import { Loader2, ChevronLeft, Sparkles, Eye, EyeOff, Trash2, Search, ImageIcon, Video, Type } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/stories")({
  component: AdminStoriesPage,
});

type Row = {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  background: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  views_count: number;
};

type Stats = { total: number; active: number; hidden: number; total_views: number; total_publishers: number };

function AdminStoriesPage() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "hidden">("all");

  useEffect(() => {
    if (loaded && !isAdmin) {
      toast.error("هذه الصفحة للمسؤولين فقط");
      navigate({ to: "/app" });
    }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: list, error: e1 }, { data: st, error: e2 }] = await Promise.all([
      (supabase as any).rpc("admin_list_all_stories"),
      (supabase as any).rpc("admin_stories_stats"),
    ]);
    setLoading(false);
    if (e1) { toast.error(e1.message); return; }
    setRows((list ?? []) as Row[]);
    if (!e2 && st && st[0]) setStats(st[0] as Stats);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const toggleHide = async (r: Row) => {
    setBusy(r.id);
    const { error } = await (supabase as any).rpc("admin_set_story_hidden", { _story: r.id, _hidden: !r.is_hidden });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(r.is_hidden ? "تم إظهار القصة" : "تم إخفاء القصة");
    invalidateStoryCache(r.user_id);
    void fetchActiveStories(true);
    setRows((arr) => arr.map((x) => x.id === r.id ? { ...x, is_hidden: !r.is_hidden } : x));
  };

  const remove = async (r: Row) => {
    if (!confirm(`حذف قصة "${r.username || "مستخدم"}" نهائياً؟`)) return;
    setBusy(r.id);
    const { error } = await (supabase as any).rpc("admin_delete_story", { _story: r.id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    invalidateStoryCache(r.user_id);
    void fetchActiveStories(true);
    setRows((arr) => arr.filter((x) => x.id !== r.id));
    if (stats) setStats({ ...stats, total: Math.max(0, stats.total - 1) });
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const isActive = new Date(r.expires_at).getTime() > now;
      if (filter === "active" && !isActive) return false;
      if (filter === "expired" && isActive) return false;
      if (filter === "hidden" && !r.is_hidden) return false;
      if (!term) return true;
      return (r.username || "").toLowerCase().includes(term) || (r.content || "").toLowerCase().includes(term);
    });
  }, [rows, q, filter]);

  if (!loaded) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  return (
    <main className="flex flex-1 flex-col p-4 gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-extrabold">تحكم شامل بالقصص</h1>
            <p className="text-xs text-muted-foreground">عرض، إخفاء، وحذف قصص كل المستخدمين</p>
          </div>
        </div>
        <Link to="/app/admin" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> رجوع
        </Link>
      </header>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {[
            { k: "الإجمالي", v: stats.total },
            { k: "نشطة", v: stats.active },
            { k: "مخفية", v: stats.hidden },
            { k: "المشاهدات", v: stats.total_views },
            { k: "ناشرون", v: stats.total_publishers },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-border bg-card p-3">
              <div className="text-xl font-extrabold">{s.v}</div>
              <div className="text-[11px] text-muted-foreground">{s.k}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المستخدم أو المحتوى…"
            className="w-full h-11 rounded-xl border border-input bg-background px-3 pe-10 text-sm outline-none focus:border-primary" />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["all", "الكل"], ["active", "نشطة"], ["hidden", "مخفية"], ["expired", "منتهية"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 h-9 rounded-lg text-xs font-semibold transition ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">لا توجد قصص</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => {
            const isActive = new Date(r.expires_at).getTime() > Date.now();
            return (
              <div key={r.id} className={`rounded-2xl border bg-card p-3 flex gap-3 ${r.is_hidden ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
                <div className="h-16 w-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-white"
                  style={r.media_url ? { background: "#000" } : { background: r.background || "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                  {r.media_url && r.media_type === "image" && <img src={r.media_url} className="w-full h-full object-cover" alt="" />}
                  {r.media_url && r.media_type === "video" && <Video className="h-5 w-5" />}
                  {!r.media_url && <Type className="h-5 w-5 opacity-70" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {r.avatar_url
                        ? <img src={r.avatar_url} className="h-5 w-5 rounded-full object-cover" alt="" />
                        : <div className="h-5 w-5 rounded-full bg-emerald-600 grid place-items-center text-white text-[10px] font-bold">{r.username?.[0] ?? "?"}</div>}
                      <span className="font-semibold text-sm truncate">{r.username || "—"}</span>
                    </div>
                    {r.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">مخفية</span>}
                    {!isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">منتهية</span>}
                    {isActive && !r.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">نشطة</span>}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{r.views_count}</span>
                  </div>
                  {r.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words">{r.content}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    نُشرت: {new Date(r.created_at).toLocaleString("ar")} • تنتهي: {new Date(r.expires_at).toLocaleString("ar")}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => toggleHide(r)} disabled={busy === r.id}
                    className={`h-8 px-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${r.is_hidden ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"}`}>
                    {r.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {r.is_hidden ? "إظهار" : "إخفاء"}
                  </button>
                  <button onClick={() => remove(r)} disabled={busy === r.id}
                    className="h-8 px-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// avoid unused import warning when no media images render
export { ImageIcon };
