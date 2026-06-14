import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Hash, Lock, Loader2, Trash2, Power, Search, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/rooms")({
  component: AdminRooms,
});

type Row = {
  id: string; name: string; description: string | null;
  type: string | null; owner_id: string; is_active: boolean | null;
  max_members: number | null; created_at: string;
  member_count?: number; owner_name?: string;
};

function AdminRooms() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (loaded && !isAdmin) { toast.error("هذه الصفحة للمسؤولين فقط"); navigate({ to: "/app" }); }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("rooms").select("id, name, description, owner_id, created_at, type, max_members, is_active").order("created_at", { ascending: false }).limit(200);
    if (data) {
      const ownerIds = Array.from(new Set(data.map((r: any) => r.owner_id).filter(Boolean)));
      const [{ data: profs }, counts] = await Promise.all([
        supabase.from("profiles").select("id, username").in("id", ownerIds),
        Promise.all(data.map((r: any) => supabase.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", r.id))),
      ]);
      const profMap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p.username; });
      const enriched: Row[] = data.map((r: any, i: number) => ({
        ...r, owner_name: profMap[r.owner_id] ?? "—", member_count: counts[i].count ?? 0,
      }));
      setRows(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const toggleActive = async (r: Row) => {
    const { error } = await supabase.from("rooms").update({ is_active: !(r.is_active ?? true) } as never).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(!r.is_active ? "تم تفعيل الغرفة" : "تم إيقاف الغرفة"); load(); }
  };

  const remove = async (r: Row) => {
    if (!confirm(`حذف الغرفة "${r.name}" نهائياً؟`)) return;
    const { error } = await supabase.from("rooms").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("تم حذف الغرفة"); setRows((prev) => prev.filter((x) => x.id !== r.id)); }
  };

  if (!loaded || !isAdmin) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const filtered = rows.filter((r) =>
    !q.trim() || r.name?.toLowerCase().includes(q.toLowerCase()) || r.owner_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <main className="flex flex-1 flex-col p-4 gap-3">
      <header>
        <h1 className="text-xl font-extrabold">التحكم بالغرف</h1>
        <p className="text-xs text-muted-foreground">جميع الغرف في التطبيق</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو المالك…"
          className="h-11 w-full rounded-2xl border border-input bg-card pr-10 pl-3 text-sm outline-none focus:border-primary" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">لا توجد غرف</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((r) => (
            <li key={r.id} className={`rounded-2xl border bg-card p-3 ${r.is_active === false ? "border-red-500/40 opacity-70" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => navigate({ to: "/app/rooms/$id", params: { id: r.id } })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  {r.type === "private" ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate({ to: "/app/rooms/$id", params: { id: r.id } })}
                      className="truncate font-bold text-start hover:underline">{r.name}</button>
                    {r.is_active === false && <span className="text-[10px] rounded bg-red-500/20 text-red-500 px-1.5 py-0.5 font-bold">موقوفة</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    المالك: {r.owner_name} · <Users className="inline h-3 w-3" /> {r.member_count}/{r.max_members ?? "∞"}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => toggleActive(r)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    r.is_active === false
                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                  }`}>
                  <Power className="h-3.5 w-3.5" /> {r.is_active === false ? "تفعيل" : "إيقاف"}
                </button>
                <button onClick={() => remove(r)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition">
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
