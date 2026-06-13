import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Flag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/community")({
  component: AdminCommunity,
});

const db = supabase as any;

function AdminCommunity() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"posts" | "reports">("reports");
  const [posts, setPosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loaded && !isAdmin) { toast.error("للمسؤولين فقط"); navigate({ to: "/app" }); }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      db.from("community_posts").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("community_reports").select("*, post:community_posts(*)").order("created_at", { ascending: false }).limit(100),
    ]);
    const ids = Array.from(new Set([...(p ?? []).map((x: any) => x.author_id), ...(r ?? []).map((x: any) => x.reporter_id)])) as string[];
    const map = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      profs?.forEach((x: any) => map.set(x.id, x));
    }
    setPosts((p ?? []).map((x: any) => ({ ...x, author: map.get(x.author_id) })));
    setReports((r ?? []).map((x: any) => ({ ...x, reporter: map.get(x.reporter_id) })));
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!loaded || !isAdmin) return null;

  const delPost = async (id: string) => {
    if (!confirm("حذف المنشور نهائياً؟")) return;
    const { error } = await db.rpc("admin_delete_post", { _post: id });
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const setReportStatus = async (id: string, status: "reviewed" | "dismissed") => {
    const { error } = await db.from("community_reports").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); load(); }
  };

  return (
    <main className="flex flex-1 flex-col p-4 gap-3">
      <header>
        <h1 className="text-xl font-extrabold">إدارة المجتمع</h1>
        <p className="text-xs text-muted-foreground">المنشورات والبلاغات</p>
      </header>

      <div className="flex gap-2">
        <button onClick={() => setTab("reports")}
          className={`flex-1 h-10 rounded-xl text-sm font-bold ${tab === "reports" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
          البلاغات ({reports.filter((r) => r.status === "open").length})
        </button>
        <button onClick={() => setTab("posts")}
          className={`flex-1 h-10 rounded-xl text-sm font-bold ${tab === "posts" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
          كل المنشورات ({posts.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tab === "reports" ? (
        <div className="space-y-2">
          {reports.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد بلاغات</p>}
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Flag className="h-4 w-4 text-destructive" />
                  <span className="font-bold">{r.reporter?.username || "مستخدم"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</span>
                </div>
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold ${
                  r.status === "open" ? "bg-amber-500/20 text-amber-700" :
                  r.status === "reviewed" ? "bg-emerald-500/20 text-emerald-700" : "bg-muted text-muted-foreground"
                }`}>{r.status}</span>
              </div>
              <div className="text-sm">السبب: {r.reason || "—"}</div>
              {r.post ? (
                <div className="rounded-xl bg-secondary/50 p-2 text-xs">
                  <div className="line-clamp-3">{r.post.content || "(وسائط فقط)"}</div>
                </div>
              ) : <div className="text-xs text-muted-foreground">(المنشور محذوف)</div>}
              <div className="flex gap-2">
                {r.post && (
                  <button onClick={() => delPost(r.post.id)}
                    className="flex h-9 items-center gap-1 rounded-xl bg-destructive/15 px-3 text-xs font-bold text-destructive">
                    <Trash2 className="h-4 w-4" /> حذف المنشور
                  </button>
                )}
                {r.status === "open" && (
                  <>
                    <button onClick={() => setReportStatus(r.id, "reviewed")}
                      className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> تمت المراجعة
                    </button>
                    <button onClick={() => setReportStatus(r.id, "dismissed")}
                      className="h-9 rounded-xl bg-secondary px-3 text-xs font-bold">رفض البلاغ</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{p.author?.username || "—"} · {new Date(p.created_at).toLocaleString("ar")}</div>
                <div className="text-sm line-clamp-3">{p.content || "(وسائط فقط)"}</div>
                {p.media_url && <div className="text-[10px] text-muted-foreground mt-1">📎 {p.media_type}</div>}
              </div>
              <button onClick={() => delPost(p.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
