import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plus, Users, Hash, Loader2, X, Search, UserPlus, Lock, Crown, Sparkles, AtSign, LogIn } from "lucide-react";
import { toast } from "sonner";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";


export const Route = createFileRoute("/app/")({
  component: RoomsPage,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  type?: string | null;
  member_count?: number;
};

function RoomsPage() {
  const { user, loading: authLoading } = useAuth(); // أضف loading
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // اعتراض زر الرجوع وإظهار نافذة التأكيد
  useEffect(() => {
    window.history.pushState({ __exitGuard: true }, "");
    const onPop = (e: PopStateEvent) => {
      setShowExitConfirm(true);
      window.history.pushState({ __exitGuard: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const doExit = () => {
    setShowExitConfirm(false);
    // محاولة إغلاق التطبيق/التبويب
    window.close();
    // كحل احتياطي: العودة لأول الصفحة
    setTimeout(() => { try { window.history.back(); } catch {} }, 50);
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setShowExitConfirm(false);
      navigate({ to: "/login" });
    } finally {
      setSigningOut(false);
    }
  };

  // التحقق من تسجيل الدخول
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;

    setError(null);

    // Seed from cache for instant offline render
    const cached = await cacheGet<Room[]>(cacheKeys.roomsList());
    if (cached) {
      setRooms(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, description, owner_id, type")
        .order("created_at", { ascending: false });

      if (roomsError) throw roomsError;

      const { data: counts } = await supabase
        .from("room_members")
        .select("room_id");

      const map = new Map<string, number>();
      counts?.forEach((m) => map.set(m.room_id, (map.get(m.room_id) ?? 0) + 1));

      const roomsWithCount = (roomsData ?? []).map((r) => ({
        ...r,
        member_count: map.get(r.id) ?? 0,
      }));

      setRooms(roomsWithCount);
      await cacheSet(cacheKeys.roomsList(), roomsWithCount);
    } catch (err) {
      if (!cached) setError("تعذر الاتصال بالخادم — يتم العمل بدون إنترنت");
    }

    setLoading(false);
  };


  useEffect(() => {
    if (user) {
      load();
    }
    
    const ch = supabase
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, () => load())
      .subscribe();
    
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // إذا كان يتحقق من المصادقة
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // إذا لم يكن هناك مستخدم، لا تعرض الصفحة (سيتم التوجيه)
  if (!user) {
    return null;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(r =>
      r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
    );
  }, [rooms, query]);

  const goToCreateRoom = () => {
    navigate({ to: "/app/create-room" });
  };

  if (error) {
    return (
      <main className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
          <p className="text-xs text-muted-foreground">{t("rooms.title")}</p>
        </header>
        <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
          <div className="rounded-2xl bg-destructive/10 p-4 text-center">
            <p className="text-destructive mb-2">حدث خطأ في تحميل الغرف</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button onClick={load} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
            <p className="text-xs text-muted-foreground">{t("rooms.title")}</p>
          </div>
          <button
            onClick={goToCreateRoom}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>غرفة جديدة</span>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-input bg-card px-3 h-11">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rooms.search")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rooms.length === 0 ? (
          <EmptyState onCreate={goToCreateRoom} />
        ) : filtered.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">{t("rooms.no_results")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {filtered.map((r, idx) => (
              <li key={r.id}>
                <RoomCard room={r} accentIndex={idx} isOwner={r.owner_id === user.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && user && (
        <CreateRoomSheet
          ownerId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold">تأكيد الخروج</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              هل تريد الخروج من التطبيق أو تسجيل الخروج من حسابك؟
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={doSignOut}
                disabled={signingOut}
                className="flex h-11 items-center justify-center rounded-xl bg-destructive font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {signingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : "تسجيل الخروج"}
              </button>
              <button
                onClick={doExit}
                className="flex h-11 items-center justify-center rounded-xl bg-secondary font-semibold text-foreground"
              >
                خروج
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex h-11 items-center justify-center rounded-xl border border-input font-semibold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <Hash className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{t("rooms.empty")}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("rooms.subtitle")}</p>
      <button onClick={onCreate} className="mt-5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        <Plus className="inline h-4 w-4 ml-1" />
        إنشاء غرفة جديدة
      </button>
    </div>
  );
}

function CreateRoomSheet({ ownerId, onClose, onCreated }: { ownerId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    
    const { error } = await supabase.from("rooms").insert({ 
      name: name.trim(), 
      description: desc.trim() || null, 
      owner_id: ownerId 
    });
    
    setBusy(false);
    
    if (error) { 
      console.error("خطأ في إنشاء الغرفة:", error);
      toast.error("فشل إنشاء الغرفة: " + error.message); 
      return; 
    }
    
    toast.success("تم إنشاء الغرفة بنجاح");
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border bg-card p-6 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">إنشاء غرفة جديدة</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("rooms.name")}
            className="h-12 rounded-2xl border border-input bg-background px-4 outline-none focus:border-foreground" maxLength={50} required />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("rooms.description")}
            className="min-h-[80px] rounded-2xl border border-input bg-background p-4 outline-none focus:border-foreground" maxLength={200} />
          <button disabled={busy} className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("rooms.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

const CARD_THEMES = [
  { ring: "from-emerald-400/60 to-teal-500/40", icon: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/20" },
  { ring: "from-amber-400/60 to-orange-500/40", icon: "from-amber-500 to-orange-600", glow: "shadow-amber-500/20" },
  { ring: "from-sky-400/60 to-indigo-500/40", icon: "from-sky-500 to-indigo-600", glow: "shadow-sky-500/20" },
  { ring: "from-fuchsia-400/60 to-pink-500/40", icon: "from-fuchsia-500 to-pink-600", glow: "shadow-fuchsia-500/20" },
  { ring: "from-rose-400/60 to-red-500/40", icon: "from-rose-500 to-red-600", glow: "shadow-rose-500/20" },
] as const;

function RoomCard({ room, accentIndex, isOwner }: { room: Room; accentIndex: number; isOwner: boolean }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const theme = CARD_THEMES[accentIndex % CARD_THEMES.length];
  const isPrivate = room.type === "private";
  const initial = (room.name?.trim()?.[0] ?? "#").toUpperCase();

  const openInvite = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setInviteOpen(true);
  };

  return (
    <>
      <div className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.ring} p-[1.5px] shadow-lg ${theme.glow} transition active:scale-[0.99]`}>
        <Link
          to="/app/rooms/$id"
          params={{ id: room.id }}
          className="relative flex items-center gap-3 rounded-[calc(1.5rem-1.5px)] bg-card/95 backdrop-blur p-3.5"
        >
          <span className="pointer-events-none absolute -top-6 -end-6 h-20 w-20 rounded-full bg-white/5 blur-2xl" />

          <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.icon} text-white shadow-md`}>
            <span className="text-lg font-black tracking-tight">{initial}</span>
            {isPrivate && (
              <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-card">
                <Lock className="h-3 w-3 text-amber-500" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold">{room.name}</span>
              {isOwner && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                  <Crown className="h-2.5 w-2.5" /> مالك
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {room.description || "اضغط للدخول والمحادثة"}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-semibold text-foreground/80">
                <Users className="h-3 w-3" />
                {room.member_count ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                نشطة
              </span>
            </div>
          </div>

          <button
            onClick={openInvite}
            aria-label="دعوة الأصدقاء"
            title="دعوة الأصدقاء"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm transition hover:brightness-110 active:scale-90"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </Link>
      </div>

      {inviteOpen && (
        <InviteModal room={room} onClose={() => setInviteOpen(false)} />
      )}
    </>
  );
}

function InviteModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const [username, setUsername] = useState("");
  const [sendingUser, setSendingUser] = useState(false);

  const sendToFriends = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("room_invite_friends" as never, { _room: room.id } as never);
      if (error) throw error;
      const count = (typeof data === "number" ? data : 0);
      if (count === 0) toast("لا يوجد أصدقاء لإرسال الدعوة إليهم");
      else toast.success(`📨 تم إرسال الدعوة إلى ${count} ${count === 1 ? "صديق" : "صديقًا"}`);
      onClose();
    } catch (e) {
      toast.error("تعذر إرسال الدعوات");
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const inviteByUsername = async () => {
    const name = username.trim();
    if (!name) { toast("أدخل اسم المستخدم"); return; }
    setSendingUser(true);
    try {
      const { error } = await supabase.rpc("room_invite_username" as never, { _room: room.id, _username: name } as never);
      if (error) throw error;
      toast.success(`📨 تم إرسال الدعوة إلى @${name}`);
      setUsername("");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("user_not_found")) toast.error("لا يوجد مستخدم بهذا الاسم");
      else if (msg.includes("cannot_invite_self")) toast.error("لا يمكنك دعوة نفسك");
      else toast.error("تعذر إرسال الدعوة");
    } finally {
      setSendingUser(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-6 pb-8 shadow-2xl sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">دعوة إلى «{room.name}»</h3>
              <p className="text-xs text-muted-foreground">ادعُ أصدقاءك أو مستخدمًا بعينه</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-bold text-muted-foreground">دعوة باسم المستخدم</label>
          <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2">
            <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") inviteByUsername(); }}
              placeholder="اسم المستخدم"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button
              onClick={inviteByUsername}
              disabled={sendingUser}
              className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground disabled:opacity-60"
            >
              {sendingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "دعوة"}
            </button>
          </div>
        </div>

        <button
          onClick={sendToFriends}
          disabled={sending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 font-bold text-white shadow-md transition active:scale-95 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><UserPlus className="h-4 w-4" /> دعوة كل الأصدقاء</>)}
        </button>
      </div>
    </div>
  );
}