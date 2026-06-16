import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/use-admin";
import { toast } from "sonner";
import {
  Activity, LogIn, LogOut, User, ShoppingBag, Coins, Gift,
  Shield, Image as ImageIcon, Crown, Sparkles, Palette, Loader2, ChevronLeft,
  Filter, Search, RefreshCw, AlertTriangle,
} from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  category: "auth" | "account" | "purchase" | "points" | "gift" | "security" | "system";
  action: string;
  old_value: string | null;
  new_value: string | null;
  meta: Record<string, any>;
  ip: string | null;
  user_agent: string | null;
  source: "user" | "admin" | "system";
  points_before: number | null;
  points_after: number | null;
  points_delta: number | null;
  created_at: string;
};

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
  validateSearch: (s: Record<string, unknown>) => ({
    user: typeof s.user === "string" ? s.user : undefined,
  }),
});

const CATEGORIES: { key: Row["category"] | "all"; label: string; icon: any; color: string }[] = [
  { key: "all",      label: "الكل",         icon: Activity,    color: "from-primary to-fuchsia-500" },
  { key: "auth",     label: "دخول وخروج",   icon: LogIn,       color: "from-emerald-500 to-teal-500" },
  { key: "account",  label: "تغييرات الحساب", icon: User,      color: "from-sky-500 to-blue-500" },
  { key: "purchase", label: "المشتريات",     icon: ShoppingBag, color: "from-amber-500 to-orange-500" },
  { key: "points",   label: "النقاط",        icon: Coins,       color: "from-yellow-500 to-amber-500" },
  { key: "gift",     label: "الهدايا",       icon: Gift,        color: "from-pink-500 to-rose-500" },
  { key: "security", label: "الأمان",        icon: Shield,      color: "from-red-500 to-rose-500" },
];

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  login:                 { label: "تسجيل الدخول",       icon: LogIn,    color: "text-emerald-500" },
  logout:                { label: "تسجيل الخروج",       icon: LogOut,   color: "text-slate-500" },
  password_changed:      { label: "تغيير كلمة المرور",   icon: Shield,   color: "text-red-500" },
  username_changed:      { label: "تغيير اسم المستخدم", icon: User,     color: "text-sky-500" },
  avatar_changed:        { label: "تغيير الصورة الشخصية", icon: ImageIcon, color: "text-fuchsia-500" },
  cover_changed:         { label: "تغيير صورة الغلاف",  icon: ImageIcon, color: "text-fuchsia-500" },
  upgraded_premium:      { label: "ترقية إلى مميز",     icon: Crown,    color: "text-amber-500" },
  downgraded_premium:    { label: "إلغاء التميز",       icon: Crown,    color: "text-slate-500" },
  badge_equipped:        { label: "تفعيل شارة",         icon: Crown,    color: "text-amber-500" },
  badge_unequipped:      { label: "إلغاء شارة",         icon: Crown,    color: "text-slate-500" },
  name_color_equipped:   { label: "تفعيل لون الاسم",     icon: Palette,  color: "text-fuchsia-500" },
  name_color_unequipped: { label: "إلغاء لون الاسم",     icon: Palette,  color: "text-slate-500" },
  chat_color_equipped:   { label: "تفعيل لون الدردشة",   icon: Palette,  color: "text-sky-500" },
  chat_color_unequipped: { label: "إلغاء لون الدردشة",   icon: Palette,  color: "text-slate-500" },
  effect_equipped:       { label: "تفعيل مؤثر",          icon: Sparkles, color: "text-fuchsia-500" },
  effect_unequipped:     { label: "إلغاء مؤثر",          icon: Sparkles, color: "text-slate-500" },
  frame_equipped:        { label: "تفعيل إطار",          icon: Sparkles, color: "text-amber-500" },
  frame_unequipped:      { label: "إلغاء إطار",          icon: Sparkles, color: "text-slate-500" },
  item_purchased:        { label: "شراء عنصر",           icon: ShoppingBag, color: "text-amber-500" },
  gift_sent:             { label: "إرسال هدية",          icon: Gift,     color: "text-pink-500" },
  gift_received:         { label: "استلام هدية",         icon: Gift,     color: "text-emerald-500" },
  points_credit:         { label: "إضافة نقاط",          icon: Coins,    color: "text-emerald-500" },
  points_debit:          { label: "خصم نقاط",            icon: Coins,    color: "text-red-500" },
  banned:                { label: "حظر الحساب",          icon: AlertTriangle, color: "text-red-500" },
  unbanned:              { label: "إلغاء الحظر",         icon: Shield,   color: "text-emerald-500" },
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  user:   { label: "المستخدم", color: "bg-sky-500/20 text-sky-600 dark:text-sky-300" },
  admin:  { label: "الإدارة",  color: "bg-rose-500/20 text-rose-600 dark:text-rose-300" },
  system: { label: "النظام",   color: "bg-slate-500/20 text-slate-600 dark:text-slate-300" },
};

function ActivityPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const targetUser = search.user;
  const isAdminView = !!targetUser && targetUser !== user?.id && isAdmin;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Row["category"] | "all">("all");
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState("");
  const [targetProfile, setTargetProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const cat = category === "all" ? null : category;
    const { data, error } = isAdminView
      ? await supabase.rpc("admin_get_activity" as never, { _target: targetUser as any, _limit: limit, _category: cat } as never)
      : await supabase.rpc("get_my_activity" as never, { _limit: limit, _category: cat } as never);
    if (error) toast.error(error.message); else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, category, limit, targetUser, isAdminView]);

  useEffect(() => {
    if (!isAdminView || !targetUser) { setTargetProfile(null); return; }
    supabase.from("profiles").select("username,avatar_url").eq("id", targetUser).maybeSingle()
      .then(({ data }) => setTargetProfile(data as any));
  }, [isAdminView, targetUser]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter(r =>
      (ACTION_META[r.action]?.label ?? r.action).toLowerCase().includes(s) ||
      (r.new_value ?? "").toLowerCase().includes(s) ||
      (r.old_value ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: isAdminView ? "/app/admin" : "/app/my_profile" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Activity className="h-5 w-5 text-primary" />
            سجل النشاط
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {isAdminView
              ? <>عرض سجل المستخدم: <span className="font-bold text-foreground">@{targetProfile?.username ?? "…"}</span></>
              : "كل عمليات حسابك في مكان واحد — شفافية كاملة"}
          </p>
        </div>
        <button onClick={load} title="تحديث"
          className="grid h-10 w-10 place-items-center rounded-full bg-card transition active:scale-95">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="بحث في السجل…"
            className="h-10 w-full rounded-xl border border-input bg-background ps-9 pe-3 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-thin">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                active ? `border-transparent bg-gradient-to-l ${c.color} text-white shadow` : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}>
              <Icon className="h-3 w-3" /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="px-3 pt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            لا توجد عمليات مسجلة
          </div>
        ) : (
          filtered.map((r) => <ActivityRow key={r.id} row={r} />)
        )}

        {!loading && filtered.length >= limit && (
          <button onClick={() => setLimit((l) => l + 50)}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold transition hover:bg-secondary">
            <Filter className="h-3.5 w-3.5" /> عرض المزيد
          </button>
        )}
      </div>

      <p className="px-6 pt-6 text-center text-[10px] text-muted-foreground">
        🔒 السجلات للقراءة فقط — لا يمكن تعديلها أو حذفها لضمان الشفافية الكاملة
      </p>
    </main>
  );
}

function ActivityRow({ row }: { row: Row }) {
  const meta = ACTION_META[row.action] ?? { label: row.action, icon: Activity, color: "text-muted-foreground" };
  const Icon = meta.icon;
  const src = SOURCE_META[row.source];

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/30">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary ${meta.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold">{meta.label}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${src.color}`}>{src.label}</span>
        </div>

        {/* Body */}
        {(row.old_value || row.new_value) && row.category !== "points" && (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {row.old_value && (
              <>
                <span className="line-through opacity-60">{shorten(row.old_value)}</span>
                <span className="mx-1">→</span>
              </>
            )}
            {row.new_value && <span className="font-semibold text-foreground">{shorten(row.new_value)}</span>}
          </div>
        )}

        {row.category === "points" && row.points_delta !== null && (
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <span className={`font-bold ${row.points_delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
              {row.points_delta > 0 ? "+" : ""}{row.points_delta.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              {row.points_before?.toLocaleString() ?? 0} → {row.points_after?.toLocaleString() ?? 0}
            </span>
          </div>
        )}

        {row.category === "gift" && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {row.meta?.emoji} {row.action === "gift_sent" ? "إلى" : "من"}{" "}
            <span className="font-bold text-foreground">
              @{row.meta?.[row.action === "gift_sent" ? "receiver_name" : "sender_name"] ?? "—"}
            </span>
            {typeof row.meta?.cost === "number" && (
              <span className="ms-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-600">
                <Coins className="h-2.5 w-2.5" /> {row.meta.cost}
              </span>
            )}
          </div>
        )}

        {row.category === "purchase" && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>النوع: <span className="font-bold text-foreground">{row.meta?.kind ?? "—"}</span></span>
            {typeof row.meta?.price === "number" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-600">
                <Coins className="h-2.5 w-2.5" /> {row.meta.price}
              </span>
            )}
          </div>
        )}

        {row.category === "auth" && row.user_agent && (
          <div className="mt-1 truncate text-[10px] text-muted-foreground">
            🖥️ {row.meta?.device ?? deviceFromUA(row.user_agent)}
            {row.ip && <span className="ms-1.5">· IP: {row.ip}</span>}
          </div>
        )}

        <div className="mt-1 text-[10px] text-muted-foreground">{formatTime(row.created_at)}</div>
      </div>
    </div>
  );
}

function shorten(v: string) {
  if (v.length > 60) return v.slice(0, 28) + "…" + v.slice(-12);
  return v;
}

function deviceFromUA(ua: string) {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mobile/i.test(ua)) return "Mobile";
  return "Web";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
}


