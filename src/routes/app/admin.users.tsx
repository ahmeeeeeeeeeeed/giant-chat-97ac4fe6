import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Shield, ShieldOff, Ban, CheckCircle2, Trash2, Coins, Pencil, Users as UsersIcon, Eye, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { adminChangePassword, adminGetPasswordHash } from "@/lib/admin.functions";

type AdminUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  points: number | null;
  country: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
  roles: string[];
};

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { user } = useAuth();
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && !isAdmin) {
      toast.error("هذه الصفحة للمسؤولين فقط");
      navigate({ to: "/app" });
    }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u =>
      (u.username ?? "").toLowerCase().includes(s) ||
      u.id.toLowerCase().includes(s)
    );
  }, [users, q]);

  const wrap = async (id: string, fn: () => PromiseLike<{ error: { message?: string } | null }>) => {
    setBusy(id);
    try {
      const res = await fn();
      if (res?.error) throw res.error;
      await load();
      toast.success("تم");
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "خطأ";
      toast.error(msg);
    } finally { setBusy(null); }
  };

  const toggleBan = (u: AdminUser) => {
    if (u.id === user?.id) { toast.error("لا يمكنك حظر نفسك"); return; }
    const reason = u.is_banned ? null : (prompt("سبب الحظر (اختياري):") ?? "");
    wrap(u.id, () => supabase.rpc("admin_set_banned", { _target: u.id, _banned: !u.is_banned, _reason: reason ?? undefined }));
  };

  const toggleAdmin = (u: AdminUser) => {
    if (u.id === user?.id) { toast.error("لا يمكنك تغيير دورك"); return; }
    const isAdminRole = u.roles?.includes("admin");
    if (!confirm(isAdminRole ? "إزالة صلاحيات المسؤول؟" : "منح صلاحيات المسؤول؟")) return;
    wrap(u.id, () => supabase.rpc("admin_set_role", { _target: u.id, _role: "admin", _grant: !isAdminRole } as never));
  };

  const sendPoints = (u: AdminUser) => {
    const v = prompt(`عدد النقاط لإرسالها إلى ${u.username ?? "المستخدم"} (يمكن سالب):`, "100");
    if (!v) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) { toast.error("قيمة غير صالحة"); return; }
    wrap(u.id, () => supabase.rpc("admin_send_points", { _target: u.id, _amount: n }));
  };

  const rename = (u: AdminUser) => {
    const v = prompt("اسم المستخدم الجديد:", u.username ?? "");
    if (!v || !v.trim()) return;
    wrap(u.id, () => supabase.rpc("admin_reset_username", { _target: u.id, _new_username: v.trim() }));
  };

  const remove = (u: AdminUser) => {
    if (u.id === user?.id) { toast.error("لا يمكنك حذف نفسك"); return; }
    if (!confirm(`حذف الحساب ${u.username ?? u.id} نهائياً؟ لا يمكن التراجع.`)) return;
    wrap(u.id, () => supabase.rpc("admin_delete_user", { _target: u.id }));
  };

  if (!loaded || (loaded && !isAdmin)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <main className="flex flex-1 flex-col p-4 gap-3">
      <header className="flex items-center gap-3">
        <UsersIcon className="h-6 w-6 text-emerald-600" />
        <div>
          <h1 className="text-xl font-extrabold">إدارة المستخدمين</h1>
          <p className="text-xs text-muted-foreground">{users.length} مستخدم</p>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو المعرّف…"
          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(u => {
            const isAdminRole = u.roles?.includes("admin");
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 overflow-hidden rounded-full bg-secondary">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold truncate">{u.username ?? "—"}</span>
                      {isAdminRole && <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5">مسؤول</span>}
                      {u.is_banned && <span className="text-[10px] rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5">محظور</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {u.points ?? 0} نقطة{u.country ? ` · ${u.country}` : ""}
                    </div>
                    {u.ban_reason && (
                      <div className="text-[11px] text-destructive truncate">سبب: {u.ban_reason}</div>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  <button onClick={() => toggleBan(u)} disabled={busy === u.id}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 text-[10px] ${u.is_banned ? "border-emerald-500/40 text-emerald-600" : "border-destructive/40 text-destructive"} disabled:opacity-50`}>
                    {u.is_banned ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    {u.is_banned ? "رفع الحظر" : "حظر"}
                  </button>
                  <button onClick={() => toggleAdmin(u)} disabled={busy === u.id}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border p-2 text-[10px] disabled:opacity-50">
                    {isAdminRole ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    {isAdminRole ? "إزالة" : "مسؤول"}
                  </button>
                  <button onClick={() => sendPoints(u)} disabled={busy === u.id}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border p-2 text-[10px] text-amber-600 disabled:opacity-50">
                    <Coins className="h-4 w-4" /> نقاط
                  </button>
                  <button onClick={() => rename(u)} disabled={busy === u.id}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border p-2 text-[10px] disabled:opacity-50">
                    <Pencil className="h-4 w-4" /> تعديل
                  </button>
                  <button onClick={() => remove(u)} disabled={busy === u.id}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-destructive/40 p-2 text-[10px] text-destructive disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> حذف
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">لا نتائج</div>
          )}
        </div>
      )}
    </main>
  );
}
