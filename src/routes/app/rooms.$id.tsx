import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Send, Loader2, ArrowLeft, Users, Hash, Lock, Settings, Shield, Ban, UserMinus,
  ArrowUp, ArrowDown, Crown, FileText, X, KeyRound, MoreVertical, Megaphone,
  UserPlus, AtSign, Edit3, Trash2, Power, Globe, Search, Info, Save, AlertTriangle,
} from "lucide-react";
import { MusicPlayer } from "@/components/MusicPlayer";
import { BroadcastCard } from "@/components/BroadcastCard";
import { SharePostModal, SharedPostCard } from "@/components/SharePostModal";
import { markRoomSeen } from "@/lib/notify";

type Rank = "owner" | "admin" | "moderator" | "member";

export const Route = createFileRoute("/app/rooms/$id")({
  component: RoomPage,
});

function RoomPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<Rank | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("members");
  const [showShare, setShowShare] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [joinPw, setJoinPw] = useState("");
  const [joining, setJoining] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userMapRef = useRef<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => { userMapRef.current = userMap; }, [userMap]);

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const need = Array.from(new Set(ids.filter((id) => id && !userMapRef.current[id])));
    if (need.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", need);
    if (data && data.length) {
      setUserMap((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = { username: p.username, avatar_url: p.avatar_url }; });
        return next;
      });
    }
  }, []);

  const loadRoom = async () => {
    const { data, error } = await supabase.from("rooms").select("id, name, description, owner_id, created_at, type, max_members, is_active").eq("id", roomId).single();
    if (error || !data) {
      toast.error("الغرفة غير موجودة");
      navigate({ to: "/app" });
      return;
    }
    setRoom(data);
    setLoading(false);
  };

  const checkBanned = async () => {
    if (!user) return false;
    const { data } = await supabase.from("room_bans").select("user_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    const banned = !!data;
    setIsBanned(banned);
    return banned;
  };

  const loadMembership = async () => {
    if (!user) return;
    const { data } = await supabase.from("room_members").select("rank").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    setMyRank((data?.rank as Rank) ?? null);
  };

  const loadMemberCount = async () => {
    const { count } = await supabase.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", roomId);
    if (count !== null) setMemberCount(count);
  };

  // Plain system messages (kick/ban/mute/role…) are ephemeral toasts —
  // not announcements, broadcasts, or shared posts.
  const isPlainSystem = (m: any) => {
    if (!(m?.message_type === "system" || !m?.user_id)) return false;
    const meta = m?.meta as any;
    if (meta?.kind === "music_broadcast" || meta?.kind === "user_share") return false;
    if ((m?.content ?? "").startsWith("📢")) return false;
    return true;
  };

  const loadMessages = async () => {
    const { data } = await supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200);
    if (data) {
      // Drop historical plain system messages from the visible list — they
      // were already shown as floating notices when they happened.
      const visible = data.filter((m: any) => !isPlainSystem(m));
      setMessages(visible);
      const ids = visible.map((m: any) => m.user_id).filter(Boolean);
      ensureProfiles(ids);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  };

  useEffect(() => {
    loadRoom();
    checkBanned();
    loadMembership();
    loadMemberCount();
    loadMessages();
    if (user?.id) ensureProfiles([user.id]);
    markRoomSeen(roomId);

    const ch = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (p) => {
          const m: any = p.new;
          // Plain system messages float as a transient notice instead of
          // joining the chat history.
          if (isPlainSystem(m)) {
            toast(m.content ?? "", { duration: 4000 });
            markRoomSeen(roomId);
            return;
          }
          setMessages((prev) => [...prev, m]);
          if (m.user_id) ensureProfiles([m.user_id]);
          markRoomSeen(roomId);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => { loadMemberCount(); loadMembership(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => setRoom(p.new))
      .subscribe();
    return () => { markRoomSeen(roomId); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  const tryJoin = async (pw?: string) => {
    if (!user || !room) return;
    const banned = await checkBanned();
    if (banned) { toast.error("أنت محظور من هذه الغرفة"); return; }
    if (room.type === "private" && !pw) { setAskPassword(true); return; }

    setJoining(true);
    const { error } = await supabase.rpc("room_join", { _room: roomId, _password: pw ?? "" });
    setJoining(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("wrong_password")) toast.error("كلمة المرور غير صحيحة");
      else if (msg.includes("banned")) toast.error("أنت محظور من هذه الغرفة");
      else if (msg.includes("room_full")) toast.error("الغرفة ممتلئة");
      else if (msg.includes("room_inactive")) toast.error("الغرفة موقوفة");
      else if (msg.includes("room_not_found")) toast.error("الغرفة غير موجودة");
      else toast.error("فشل الانضمام: " + msg);
      return;
    }
    setAskPassword(false);
    setJoinPw("");
    toast.success("تم الانضمام");
    loadMembership();
    loadMemberCount();
  };

  const leaveRoom = async () => setShowLeaveConfirm(true);
  const doLeave = async () => {
    setShowLeaveConfirm(false);
    const { error } = await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user!.id);
    if (error) toast.error("فشل المغادرة");
    else { setMyRank(null); navigate({ to: "/app" }); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;
    if (!myRank) { toast.error("يجب الانضمام إلى الغرفة أولاً"); return; }
    if (isBanned) { toast.error("أنت محظور من هذه الغرفة"); return; }
    setSending(true);
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId, user_id: user.id, content: text.trim(),
    } as never);
    setSending(false);
    if (!error) setText(""); else toast.error("فشل إرسال الرسالة");
  };

  const sendAnnouncement = async () => {
    if (!announceText.trim()) return;
    const { error } = await supabase.rpc("room_bot_say", {
      _room: roomId, _text: `📢 ${announceText.trim()}`,
    });
    if (error) toast.error("فشل الإرسال");
    else { toast.success("تم نشر الإعلان"); setAnnounceText(""); setShowAnnounce(false); }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!room) {
    return <div className="flex h-screen items-center justify-center bg-background"><p className="text-muted-foreground">الغرفة غير موجودة</p></div>;
  }

  const isMember = !!myRank;
  const canModerate = myRank === "owner" || myRank === "admin" || myRank === "moderator";
  const isOwner = myRank === "owner";
  const roomInitial = (room.name ?? "?").trim().charAt(0).toUpperCase();
  const filteredMessages = search.trim()
    ? messages.filter((m) => (m.content ?? "").toLowerCase().includes(search.toLowerCase()))
    : messages;

  const openSettingsAt = (t: SettingsTab) => { setSettingsTab(t); setShowSettings(true); };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary transition shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setShowInfo(true)} className="flex items-center gap-2.5 min-w-0 flex-1 text-start">
              <div className="relative shrink-0">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white font-extrabold text-lg shadow-lg ${
                  room.type === "private"
                    ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
                    : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600"
                }`}>
                  {roomInitial}
                </div>
                {!room.is_active && (
                  <span className="absolute -bottom-1 -end-1 rounded-full bg-red-500 p-0.5">
                    <Power className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {room.type === "private" ? <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : <Hash className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  <h1 className="font-bold text-base truncate">{room.name}</h1>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{memberCount}/{room.max_members}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="truncate">{room.type === "private" ? "خاصة" : "عامة"}</span>
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowSearch((v) => !v)} className="rounded-lg p-2 hover:bg-secondary transition" aria-label="بحث">
              <Search className="h-4.5 w-4.5" />
            </button>
            <button onClick={() => openSettingsAt("members")} className="rounded-lg p-2 hover:bg-secondary transition" aria-label="الإعدادات">
              <Settings className="h-4.5 w-4.5" />
            </button>
            {isMember ? (
              <button onClick={leaveRoom} className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition">
                مغادرة
              </button>
            ) : (
              <button onClick={() => tryJoin()} disabled={joining || isBanned}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:from-emerald-600 hover:to-emerald-700 transition disabled:opacity-50">
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : isBanned ? "محظور" : "انضمام"}
              </button>
            )}
          </div>
        </div>

        {showSearch && (
          <div className="border-t border-border px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في رسائل الغرفة..." className="flex-1 h-9 bg-transparent text-sm outline-none" />
              {search && (
                <button onClick={() => setSearch("")} className="p-1"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              )}
            </div>
          </div>
        )}

        {/* Quick action chips */}
        {isMember && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-thin">
            <ChipBtn icon={<UserPlus className="h-3 w-3" />} label="دعوة" onClick={() => openSettingsAt("invite")} />
            <ChipBtn icon={<Users className="h-3 w-3" />} label={`الأعضاء (${memberCount})`} onClick={() => openSettingsAt("members")} />
            {canModerate && <ChipBtn icon={<Megaphone className="h-3 w-3" />} label="إعلان" onClick={() => setShowAnnounce(true)} highlight />}
            {canModerate && <ChipBtn icon={<Ban className="h-3 w-3" />} label="الحظر" onClick={() => openSettingsAt("bans")} />}
            {canModerate && <ChipBtn icon={<FileText className="h-3 w-3" />} label="السجل" onClick={() => openSettingsAt("logs")} />}
            {isOwner && <ChipBtn icon={<Edit3 className="h-3 w-3" />} label="إعدادات الغرفة" onClick={() => openSettingsAt("manage")} />}
          </div>
        )}
      </header>

      <MusicPlayer roomId={roomId} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 mb-3">
              <Hash className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-muted-foreground font-medium">{search ? "لا توجد نتائج" : "لا توجد رسائل بعد"}</p>
            {!search && <p className="text-xs text-muted-foreground/70 mt-1">ابدأ المحادثة الآن 👋</p>}
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            const isSystem = msg.message_type === "system" || !msg.user_id;
            const d = new Date(msg.created_at);
            const time = d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
            const date = d.toLocaleDateString("ar", { day: "2-digit", month: "2-digit" });
            const prof = msg.user_id ? userMap[msg.user_id] : null;

            if (isSystem) {
              const meta = msg.meta as any;
              if (meta?.kind === "music_broadcast" && meta?.broadcast_id && meta?.track) {
                return (
                  <BroadcastCard key={msg.id} broadcastId={meta.broadcast_id}
                    requesterName={meta.requester_name} sourceRoomName={meta.source_room_name} track={meta.track} />
                );
              }
              if (meta?.kind === "user_share") return <SharedPostCard key={msg.id} meta={meta} />;
              const isAnnounce = (msg.content ?? "").startsWith("📢");
              if (isAnnounce) {
                return (
                  <div key={msg.id} className="mx-auto max-w-[92%] rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-1">
                      <Megaphone className="h-3.5 w-3.5" /> إعلان من الإدارة
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{(msg.content ?? "").replace(/^📢\s*/, "")}</p>
                    <p className="text-[10px] text-muted-foreground mt-1" suppressHydrationWarning>{time}</p>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground" suppressHydrationWarning>
                    {msg.content} · {time}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex items-start gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                {!isOwn && msg.user_id && (
                  <button
                    onClick={() => navigate({ to: "/app/profile/$id", params: { id: msg.user_id } })}
                    className="mt-0.5 shrink-0 transition active:scale-95"
                    aria-label="عرض البروفايل"
                  >
                    {prof?.avatar_url ? (
                      <img src={prof.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-500/20" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">
                        {(prof?.username ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                )}
                <div className={`flex max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  {msg.user_id && (
                    <button
                      onClick={() => navigate({ to: "/app/profile/$id", params: { id: msg.user_id } })}
                      className="flex items-center gap-1.5 px-1 text-xs font-bold text-emerald-600 hover:underline"
                    >
                      {(isOwn ? userMap[user!.id]?.username : prof?.username) ?? "مستخدم"}
                    </button>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                      isOwn
                        ? "rounded-br-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                        : "rounded-bl-md border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{msg.content}</p>
                  </div>
                  <p className={`mt-1 text-[10px] ${isOwn ? "text-muted-foreground" : "text-muted-foreground/80"}`} suppressHydrationWarning>
                    {date} · {time}
                  </p>
                </div>
                {isOwn && (
                  <div className="mt-0.5 shrink-0">
                    {prof?.avatar_url || userMap[user!.id]?.avatar_url ? (
                      <img src={prof?.avatar_url ?? userMap[user!.id]?.avatar_url ?? ""} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-500/30" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white">
                        {(userMap[user!.id]?.username ?? "أ").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form onSubmit={sendMessage} className="border-t border-border bg-background/90 backdrop-blur p-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowShare(true)} disabled={!isMember || isBanned}
            title="نشر منشور في كل الغرف"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 disabled:opacity-50 hover:bg-emerald-500/20 transition">
            <Megaphone className="h-5 w-5" />
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)}
            placeholder={isMember ? (isBanned ? "أنت محظور" : "اكتب رسالة...") : "يجب الانضمام إلى الغرفة أولاً"} disabled={!isMember || isBanned}
            className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition" />
          <button type="submit" disabled={sending || !text.trim() || !isMember || isBanned}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md disabled:opacity-50 transition hover:from-emerald-600 hover:to-emerald-700">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>

      {showShare && <SharePostModal roomId={roomId} onClose={() => setShowShare(false)} />}

      {askPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAskPassword(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4"><KeyRound className="h-5 w-5 text-amber-500" /><h3 className="font-bold text-lg">كلمة مرور الغرفة</h3></div>
            <input type="password" value={joinPw} onChange={(e) => setJoinPw(e.target.value)} placeholder="أدخل كلمة المرور" autoFocus
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setAskPassword(false)} className="flex-1 h-11 rounded-xl border border-border font-medium">إلغاء</button>
              <button onClick={() => tryJoin(joinPw)} disabled={joining || !joinPw}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50">
                {joining ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "دخول"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowLeaveConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">تأكيد الخروج</h3>
            <p className="text-sm text-muted-foreground mb-6">هل تريد مغادرة الغرفة؟</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 h-11 rounded-xl border border-border font-medium">إلغاء</button>
              <button onClick={doLeave} className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition">
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => setShowInfo(false)}>
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className={`p-6 text-center text-white ${room.type === "private" ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500" : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600"}`}>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur text-3xl font-extrabold mb-3">
                {roomInitial}
              </div>
              <h2 className="text-xl font-bold flex items-center justify-center gap-2">
                {room.type === "private" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {room.name}
              </h2>
              {room.description && <p className="text-sm opacity-90 mt-2">{room.description}</p>}
            </div>
            <div className="p-4 grid grid-cols-3 gap-2 text-center">
              <InfoStat icon={<Users className="h-4 w-4" />} value={`${memberCount}/${room.max_members}`} label="الأعضاء" />
              <InfoStat icon={<Hash className="h-4 w-4" />} value={room.type === "private" ? "خاصة" : "عامة"} label="النوع" />
              <InfoStat icon={<Power className="h-4 w-4" />} value={room.is_active ? "نشطة" : "موقوفة"} label="الحالة" />
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setShowInfo(false)} className="w-full h-11 rounded-xl bg-secondary font-medium">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {showAnnounce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAnnounce(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-lg">إعلان للأعضاء</h3>
            </div>
            <textarea value={announceText} onChange={(e) => setAnnounceText(e.target.value)} autoFocus rows={4}
              placeholder="اكتب نص الإعلان..."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary mb-4 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setShowAnnounce(false)} className="flex-1 h-11 rounded-xl border border-border font-medium">إلغاء</button>
              <button onClick={sendAnnouncement} disabled={!announceText.trim()}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium disabled:opacity-50">
                نشر
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsSheet
          roomId={roomId} room={room}
          canModerate={canModerate} myRank={myRank} isOwner={isOwner}
          ownerId={room.owner_id} onClose={() => setShowSettings(false)}
          ensureProfiles={ensureProfiles} userMap={userMap}
          tab={settingsTab} setTab={setSettingsTab}
          onDeleted={() => navigate({ to: "/app" })}
        />
      )}
    </div>
  );
}

function ChipBtn({ icon, label, onClick, highlight }: { icon: React.ReactNode; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
        highlight
          ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
          : "bg-secondary text-foreground hover:bg-secondary/80"
      }`}>
      {icon}<span>{label}</span>
    </button>
  );
}

function InfoStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="flex items-center justify-center text-emerald-600 mb-1">{icon}</div>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

type SettingsTab = "members" | "invite" | "bans" | "logs" | "manage";

function SettingsSheet({ roomId, room, canModerate, myRank, isOwner, ownerId, onClose, ensureProfiles, userMap, tab, setTab, onDeleted }: {
  roomId: string; room: any; canModerate: boolean; myRank: Rank | null; isOwner: boolean; ownerId: string;
  onClose: () => void; ensureProfiles: (ids: string[]) => Promise<void>;
  userMap: Record<string, { username: string; avatar_url: string | null }>;
  tab: SettingsTab; setTab: (t: SettingsTab) => void;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const load = async () => {
    if (tab === "members") {
      const { data } = await supabase.from("room_members").select("user_id, rank, joined_at").eq("room_id", roomId).order("joined_at");
      if (data) { setMembers(data); await ensureProfiles(data.map((m: any) => m.user_id)); }
    } else if (tab === "bans") {
      const { data } = await supabase.from("room_bans").select("user_id, banned_by, reason, created_at").eq("room_id", roomId).order("created_at", { ascending: false });
      if (data) { setBans(data); await ensureProfiles(data.flatMap((b: any) => [b.user_id, b.banned_by])); }
    } else if (tab === "logs") {
      const { data } = await supabase.from("room_logs").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100);
      if (data) { setLogs(data); await ensureProfiles(data.flatMap((l: any) => [l.actor_id, l.target_id]).filter(Boolean)); }
    } else if (tab === "manage" || tab === "invite") {
      const { data } = await supabase.from("room_members").select("user_id, rank, joined_at").eq("room_id", roomId);
      if (data) { setMembers(data); await ensureProfiles(data.map((m: any) => m.user_id)); }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const act = async (p: any, okMsg: string) => {
    const { error } = await p;
    if (error) toast.error(error.message); else { toast.success(okMsg); load(); }
  };

  const kick = (uid: string) => act(supabase.rpc("kick_room_member", { _room: roomId, _user: uid }), "تم الطرد");
  const ban = (uid: string) => {
    const reason = prompt("سبب الحظر (اختياري)") ?? "";
    return act(supabase.rpc("ban_room_member", { _room: roomId, _user: uid, _reason: reason }), "تم الحظر");
  };
  const unban = (uid: string) => act(supabase.rpc("unban_room_member", { _room: roomId, _user: uid }), "تم إلغاء الحظر");
  const setRank = (uid: string, rank: "admin" | "moderator" | "member", okMsg: string) =>
    act(supabase.rpc("set_member_rank", { _room: roomId, _user: uid, _new_rank: rank }), okMsg);

  // Group members by rank
  const grouped = {
    owner: members.filter((m) => m.rank === "owner"),
    admin: members.filter((m) => m.rank === "admin"),
    moderator: members.filter((m) => m.rank === "moderator"),
    member: members.filter((m) => m.rank === "member"),
  };

  const Tab = ({ id, icon, label, show = true }: { id: SettingsTab; icon: React.ReactNode; label: string; show?: boolean }) => {
    if (!show) return null;
    return (
      <button onClick={() => setTab(id)}
        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
          tab === id ? "border-emerald-500 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground"
        }`}>
        {icon}<span>{label}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-h-[88vh] overflow-hidden rounded-t-3xl bg-card flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500" /> إعدادات الغرفة
          </h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 border-b border-border px-2 overflow-x-auto">
          <Tab id="members" icon={<Users className="h-4 w-4" />} label="الأعضاء" />
          <Tab id="invite" icon={<UserPlus className="h-4 w-4" />} label="دعوة" />
          <Tab id="bans" icon={<Ban className="h-4 w-4" />} label="الحظر" show={canModerate} />
          <Tab id="logs" icon={<FileText className="h-4 w-4" />} label="السجل" show={canModerate} />
          <Tab id="manage" icon={<Edit3 className="h-4 w-4" />} label="إدارة" show={isOwner} />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === "members" && (
            <div className="space-y-4">
              {(["owner", "admin", "moderator", "member"] as Rank[]).map((rk) => {
                const list = grouped[rk];
                if (list.length === 0) return null;
                const label = rk === "owner" ? "المالك" : rk === "admin" ? "المسؤولون" : rk === "moderator" ? "المشرفون" : "الأعضاء";
                return (
                  <div key={rk}>
                    <div className="text-[11px] font-bold text-muted-foreground px-1 mb-1.5 uppercase tracking-wider">
                      {label} ({list.length})
                    </div>
                    <ul className="space-y-2">
                      {list.map((m) => {
                        const p = userMap[m.user_id];
                        return (
                          <li key={m.user_id} className="flex items-center gap-3 rounded-xl bg-background border border-border/50 p-3 hover:border-emerald-500/30 transition">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold overflow-hidden">
                                {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p?.username?.[0] ?? "?")}
                              </div>
                              {m.rank === "owner" && (
                                <Crown className="absolute -top-1 -end-1 h-4 w-4 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">{p?.username ?? "..."}</span>
                                <RankBadge rank={m.rank} />
                              </div>
                            </div>
                            {canModerate && m.user_id !== ownerId && (
                              <MemberMenu
                                myRank={myRank} rank={m.rank}
                                onMakeAdmin={() => setRank(m.user_id, "admin", "تمت الترقية إلى مسؤول")}
                                onMakeModerator={() => setRank(m.user_id, "moderator", "تمت الترقية إلى مشرف")}
                                onMakeMember={() => setRank(m.user_id, "member", "تم التخفيض إلى عضو")}
                                onKick={() => kick(m.user_id)}
                                onBan={() => ban(m.user_id)}
                                onTransfer={isOwner ? () => {
                                  if (!confirm(`نقل ملكية الغرفة إلى ${p?.username}؟`)) return;
                                  act(supabase.rpc("transfer_room_ownership", { _room: roomId, _new_owner: m.user_id }), "تم نقل الملكية");
                                } : undefined}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {members.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا يوجد أعضاء</p>}
            </div>
          )}

          {tab === "invite" && (
            <InviteTab roomId={roomId} />
          )}

          {canModerate && tab === "bans" && (
            <ul className="space-y-2">
              {bans.map((b) => {
                const p = userMap[b.user_id];
                return (
                  <li key={b.user_id} className="flex items-center gap-3 rounded-xl bg-background border border-border/50 p-3">
                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><Ban className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p?.username ?? "..."}</div>
                      {b.reason && <div className="text-xs text-muted-foreground truncate">{b.reason}</div>}
                    </div>
                    <button onClick={() => unban(b.user_id)} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">إلغاء الحظر</button>
                  </li>
                );
              })}
              {bans.length === 0 && <li className="text-center text-sm text-muted-foreground py-8">لا يوجد محظورون</li>}
            </ul>
          )}

          {canModerate && tab === "logs" && (
            <ul className="space-y-2">
              {logs.map((l) => {
                const actor = l.actor_id ? userMap[l.actor_id]?.username : null;
                const target = l.target_id ? userMap[l.target_id]?.username : null;
                const evText: Record<string, string> = {
                  join: `👋 انضم ${target ?? "—"}`,
                  leave: `🚪 غادر ${target ?? "—"}`,
                  kick: `⚠️ ${actor ?? "—"} طرد ${target ?? "—"}`,
                  ban: `🚫 ${actor ?? "—"} حظر ${target ?? "—"}`,
                  unban: `✅ ${actor ?? "—"} ألغى حظر ${target ?? "—"}`,
                  promote: `⬆️ ترقية ${target ?? "—"}`,
                  demote: `⬇️ تخفيض ${target ?? "—"}`,
                  transfer: `👑 نقل الملكية إلى ${target ?? "—"}`,
                };
                return (
                  <li key={l.id} className="rounded-xl bg-background border border-border/50 p-3 text-sm">
                    <div>{evText[l.event] ?? l.event}</div>
                    <div className="text-[11px] text-muted-foreground mt-1" suppressHydrationWarning>
                      {new Date(l.created_at).toLocaleString("ar")}
                    </div>
                  </li>
                );
              })}
              {logs.length === 0 && <li className="text-center text-sm text-muted-foreground py-8">السجل فارغ</li>}
            </ul>
          )}

          {isOwner && tab === "manage" && (
            <ManageTab room={room} roomId={roomId} onDeleted={onDeleted} />
          )}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: string }) {
  if (rank === "owner") return <span className="text-[10px] rounded bg-amber-500/20 text-amber-600 px-1.5 py-0.5 font-bold">مالك</span>;
  if (rank === "admin") return <span className="text-[10px] rounded bg-blue-500/20 text-blue-600 px-1.5 py-0.5 font-bold">مسؤول</span>;
  if (rank === "moderator") return <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 font-bold">مشرف</span>;
  return <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">عضو</span>;
}

function InviteTab({ roomId }: { roomId: string }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteByUsername = async () => {
    if (!username.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("room_invite_username", { _room: roomId, _username: username.trim() });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      if (m.includes("user_not_found")) toast.error("المستخدم غير موجود");
      else if (m.includes("cannot_invite_self")) toast.error("لا يمكن دعوة نفسك");
      else toast.error("فشل: " + m);
      return;
    }
    toast.success(`تم إرسال دعوة إلى ${username}`);
    setUsername("");
  };

  const inviteAll = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("room_invite_friends", { _room: roomId });
    setBusy(false);
    if (error) { toast.error("فشل: " + error.message); return; }
    toast.success(`تم إرسال ${data ?? 0} دعوة`);
  };

  return (
    <div className="space-y-4 p-2">
      <div className="rounded-2xl border border-border bg-background p-4">
        <label className="text-xs font-bold text-muted-foreground mb-2 block">دعوة باسم المستخدم</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-input bg-background px-3">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم" className="flex-1 h-10 bg-transparent text-sm outline-none" />
          </div>
          <button onClick={inviteByUsername} disabled={busy || !username.trim()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "دعوة"}
          </button>
        </div>
      </div>

      <button onClick={inviteAll} disabled={busy}
        className="w-full h-12 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-600 font-bold text-sm hover:bg-emerald-500/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
        <UserPlus className="h-4 w-4" /> دعوة كل الأصدقاء
      </button>

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3 flex gap-2">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          يتم إرسال الدعوة كرسالة خاصة للمستخدم تتضمن رابط الغرفة.
        </p>
      </div>
    </div>
  );
}

function ManageTab({ room, roomId, onDeleted }: { room: any; roomId: string; onDeleted: () => void }) {
  const [name, setName] = useState(room.name ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  const [type, setType] = useState<string>(room.type ?? "public");
  const [maxMembers, setMaxMembers] = useState<number>(room.max_members ?? 50);
  const [isActive, setIsActive] = useState<boolean>(room.is_active ?? true);
  const [password, setPassword] = useState("");
  const [changePw, setChangePw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(room.name ?? "");
    setDescription(room.description ?? "");
    setType(room.type ?? "public");
    setMaxMembers(room.max_members ?? 50);
    setIsActive(room.is_active ?? true);
  }, [room]);

  const save = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    const update: any = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      max_members: Math.max(2, Math.min(500, Number(maxMembers) || 50)),
      is_active: isActive,
    };
    if (type === "private" && changePw && password.trim()) update.password_hash = password.trim();
    if (type === "public") update.password_hash = null;
    const { error } = await supabase.from("rooms").update(update).eq("id", roomId);
    setSaving(false);
    if (error) toast.error("فشل الحفظ: " + error.message);
    else { toast.success("تم حفظ التغييرات"); setChangePw(false); setPassword(""); }
  };

  const deleteRoom = async () => {
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) toast.error("فشل الحذف: " + error.message);
    else { toast.success("تم حذف الغرفة"); onDeleted(); }
  };

  return (
    <div className="space-y-4 p-1">
      <Field label="اسم الغرفة">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
          className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-emerald-500" />
      </Field>

      <Field label="الوصف">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={200}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-emerald-500 resize-none" />
      </Field>

      <Field label="نوع الغرفة">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setType("public")}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${type === "public" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background"}`}>
            <Globe className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-bold">عامة</span>
          </button>
          <button onClick={() => setType("private")}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${type === "private" ? "border-amber-500 bg-amber-500/10" : "border-border bg-background"}`}>
            <Lock className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-bold">خاصة</span>
          </button>
        </div>
      </Field>

      {type === "private" && (
        <Field label="كلمة المرور">
          {!changePw ? (
            <button onClick={() => setChangePw(true)}
              className="w-full h-11 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 text-amber-600 text-sm font-bold flex items-center justify-center gap-2">
              <KeyRound className="h-4 w-4" /> تغيير كلمة المرور
            </button>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة مرور جديدة"
                className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-emerald-500" />
              <button onClick={() => { setChangePw(false); setPassword(""); }} className="h-11 px-3 rounded-xl border border-border text-xs">إلغاء</button>
            </div>
          )}
        </Field>
      )}

      <Field label={`الحد الأقصى للأعضاء: ${maxMembers}`}>
        <input type="range" min={2} max={500} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))}
          className="w-full accent-emerald-500" />
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>2</span><span>500</span></div>
      </Field>

      <Field label="حالة الغرفة">
        <button onClick={() => setIsActive((v) => !v)}
          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}`}>
          <div className="flex items-center gap-2">
            <Power className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-red-500"}`} />
            <span className="text-sm font-bold">{isActive ? "نشطة" : "موقوفة"}</span>
          </div>
          <div className={`h-5 w-9 rounded-full transition relative ${isActive ? "bg-emerald-500" : "bg-muted"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isActive ? "end-0.5" : "start-0.5"}`} />
          </div>
        </button>
      </Field>

      <button onClick={save} disabled={saving}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        حفظ التغييرات
      </button>

      <div className="border-t border-border pt-4 mt-4">
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-bold text-red-600">منطقة الخطر</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">حذف الغرفة سيؤدي إلى فقدان جميع الرسائل والإعدادات بشكل نهائي.</p>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full h-10 rounded-xl bg-red-500/10 text-red-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition">
              <Trash2 className="h-4 w-4" /> حذف الغرفة
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium">إلغاء</button>
              <button onClick={deleteRoom}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition">
                تأكيد الحذف
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function MemberMenu({ myRank, rank, onMakeAdmin, onMakeModerator, onMakeMember, onKick, onBan, onTransfer }: {
  myRank: Rank | null; rank: Rank;
  onMakeAdmin: () => void; onMakeModerator: () => void; onMakeMember: () => void;
  onKick: () => void; onBan: () => void; onTransfer?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  const item = "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-start";
  const canManageRanks = myRank === "owner" || myRank === "admin";
  const isMod = myRank === "moderator";
  const canActOnTarget = !isMod || rank === "member";
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-secondary" aria-label="خيارات">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          {canManageRanks && rank !== "admin" && (
            <button onClick={() => { setOpen(false); onMakeAdmin(); }} className={`${item} text-blue-600`}>
              <Shield className="h-4 w-4" /> تعيين مسؤول
            </button>
          )}
          {canManageRanks && rank !== "moderator" && (
            <button onClick={() => { setOpen(false); onMakeModerator(); }} className={`${item} text-emerald-600`}>
              <ArrowUp className="h-4 w-4" /> تعيين مشرف
            </button>
          )}
          {canManageRanks && rank !== "member" && (
            <button onClick={() => { setOpen(false); onMakeMember(); }} className={`${item} text-orange-600`}>
              <ArrowDown className="h-4 w-4" /> إعادة إلى عضو
            </button>
          )}
          {onTransfer && (
            <button onClick={() => { setOpen(false); onTransfer(); }} className={`${item} text-amber-600`}>
              <Crown className="h-4 w-4" /> نقل الملكية
            </button>
          )}
          {canActOnTarget && (
            <button onClick={() => { setOpen(false); onKick(); }} className={`${item} text-orange-600`}>
              <UserMinus className="h-4 w-4" /> طرد
            </button>
          )}
          {canActOnTarget && (
            <button onClick={() => { setOpen(false); onBan(); }} className={`${item} text-red-600`}>
              <Ban className="h-4 w-4" /> حظر
            </button>
          )}
        </div>
      )}
    </div>
  );
}
