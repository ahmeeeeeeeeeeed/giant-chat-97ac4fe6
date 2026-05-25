import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Send, Settings as SettingsIcon, LogOut, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rooms/$id")({
  component: RoomPage,
});

type Msg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
};
type Room = { id: string; name: string; description: string | null; owner_id: string };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ensure membership, then load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: roomData, error: rErr } = await supabase
        .from("rooms").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (rErr || !roomData) { toast.error("الغرفة غير موجودة"); navigate({ to: "/app" }); return; }
      setRoom(roomData);

      // upsert membership (joined_at stays = first join unless deleted previously)
      const { data: existing } = await supabase
        .from("room_members").select("user_id").eq("room_id", id).eq("user_id", user.id).maybeSingle();
      if (!existing) {
        await supabase.from("room_members").insert({ room_id: id, user_id: user.id });
      }

      await loadMessages();
      await loadMemberCount();
    })();

    return () => { cancelled = true; };
  }, [id, user]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("room_messages")
      .select("id, user_id, content, created_at")
      .eq("room_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    const msgs = data ?? [];
    setMessages(msgs);
    const userIds = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, username").in("id", userIds);
      const map: Record<string, string> = {};
      profs?.forEach((p) => (map[p.id] = p.username));
      setProfilesMap(map);
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  const loadMemberCount = async () => {
    const { count } = await supabase
      .from("room_members").select("*", { count: "exact", head: true }).eq("room_id", id);
    setMemberCount(count ?? 0);
  };

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`room:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Msg;
          // fetch username if unknown
          if (!profilesMap[m.user_id]) {
            const { data: p } = await supabase.from("profiles").select("username").eq("id", m.user_id).maybeSingle();
            if (p) setProfilesMap((old) => ({ ...old, [m.user_id]: p.username }));
          }
          setMessages((old) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 30);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` },
        () => loadMemberCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user, profilesMap]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("room_messages")
      .insert({ room_id: id, user_id: user.id, content });
    setSending(false);
    if (error) { toast.error("تعذّر الإرسال"); setText(content); }
  };

  const leaveRoom = async () => {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id);
    toast.success("غادرت الغرفة، سيتم مسح سجل الرسائل");
    navigate({ to: "/app" });
  };

  if (!room) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جاري التحميل…</div>;
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate({ to: "/app" })} aria-label="رجوع">
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{room.name}</h1>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="online-dot inline-block h-1.5 w-1.5 rounded-full" />
            {memberCount} عضو
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} aria-label="إعدادات">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد. كن أول من يكتب!</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <li key={m.id} className={`bubble-in flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-card text-foreground"
                    }`}
                  >
                    {!mine && (
                      <div className="mb-0.5 text-[11px] font-semibold text-muted-foreground">
                        {profilesMap[m.user_id] ?? "…"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة…"
          className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="إرسال"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
        </button>
      </form>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="mb-1 text-lg font-bold">{room.name}</h2>
            {room.description && <p className="mb-4 text-sm text-muted-foreground">{room.description}</p>}
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />{memberCount} عضو</div>
            <button
              onClick={leaveRoom}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 font-semibold text-destructive"
            >
              <LogOut className="h-4 w-4" />
              الخروج من الغرفة
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">سيتم حذف سجل الرسائل من حسابك</p>
          </div>
        </div>
      )}
    </main>
  );
}
