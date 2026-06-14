import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Send, Loader2, ArrowLeft, Users, Hash, Lock, Settings, Shield, Ban, UserMinus, ArrowUp, ArrowDown, Crown, FileText, X, KeyRound, MoreVertical, Megaphone } from "lucide-react";
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
  const [showShare, setShowShare] = useState(false);
  const [askPassword, setAskPassword] = useState(false);
  const [joinPw, setJoinPw] = useState("");
  const [joining, setJoining] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

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
    const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
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

  const loadMessages = async () => {
    const { data } = await supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200);
    if (data) {
      setMessages(data);
      const ids = data.map((m: any) => m.user_id).filter(Boolean);
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
          setMessages((prev) => [...prev, m]);
          if (m.user_id) ensureProfiles([m.user_id]);
          markRoomSeen(roomId);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => { loadMemberCount(); loadMembership(); })
      .subscribe();
    return () => { markRoomSeen(roomId); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  const tryJoin = async (pw?: string) => {
    if (!user || !room) return;
    
    // التحقق من الحظر أولاً
    const banned = await checkBanned();
    if (banned) {
      toast.error("أنت محظور من هذه الغرفة");
      return;
    }
    
    // إذا كانت الغرفة خاصة وتحتاج كلمة مرور
    if (room.type === "private" && !pw) {
      setAskPassword(true);
      return;
    }
    
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

  const leaveRoom = async () => {
    if (!confirm("هل تريد مغادرة الغرفة؟")) return;
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!room) {
    return <div className="flex h-screen items-center justify-center bg-background"><p className="text-muted-foreground">الغرفة غير موجودة</p></div>;
  }

  const isMember = !!myRank;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary transition"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {room.type === "private" ? <Lock className="h-4 w-4 text-amber-500" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
              <h1 className="font-bold text-lg truncate">{room.name}</h1>
            </div>
            {room.description && <p className="text-xs text-muted-foreground truncate">{room.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 transition">
            <Users className="h-3.5 w-3.5" /><span>عرض الأعضاء ({memberCount})</span>
          </button>
          {isMember ? (
            <button onClick={leaveRoom} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/20 transition">مغادرة</button>
          ) : (
            <button onClick={() => tryJoin()} disabled={joining || isBanned}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : isBanned ? "محظور" : "انضمام"}
            </button>
          )}
        </div>
      </header>

      <MusicPlayer roomId={roomId} />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Hash className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد رسائل بعد</p>
          </div>
        ) : (
          messages.map((msg) => {
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
                  <BroadcastCard
                    key={msg.id}
                    broadcastId={meta.broadcast_id}
                    requesterName={meta.requester_name}
                    sourceRoomName={meta.source_room_name}
                    track={meta.track}
                  />
                );
              }
              if (meta?.kind === "user_share") {
                return <SharedPostCard key={msg.id} meta={meta} />;
              }
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground" suppressHydrationWarning>
                    {msg.content} · {time}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                {!isOwn && msg.user_id && (
                  <button
                    onClick={() => navigate({ to: "/app/profile/$id", params: { id: msg.user_id } })}
                    className="shrink-0 transition active:scale-95"
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
                      className="mb-1 px-1 text-xs font-bold text-emerald-600 hover:underline"
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
                  <div className="shrink-0">
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

      <form onSubmit={sendMessage} className="border-t border-border bg-background p-4">
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
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition hover:bg-primary/90">
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

      {showSettings && (
        <SettingsSheet roomId={roomId} canModerate={myRank === "owner" || myRank === "admin" || myRank === "moderator"} myRank={myRank}
          ownerId={room.owner_id} onClose={() => setShowSettings(false)} ensureProfiles={ensureProfiles} userMap={userMap} />
      )}
    </div>
  );
}

function SettingsSheet({ roomId, canModerate, myRank, ownerId, onClose, ensureProfiles, userMap }: {
  roomId: string; canModerate: boolean; myRank: Rank | null; ownerId: string; onClose: () => void;
  ensureProfiles: (ids: string[]) => Promise<void>;
  userMap: Record<string, { username: string; avatar_url: string | null }>;
}) {
  const [tab, setTab] = useState<"members" | "bans" | "logs">("members");
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
    } else {
      const { data } = await supabase.from("room_logs").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100);
      if (data) { setLogs(data); await ensureProfiles(data.flatMap((l: any) => [l.actor_id, l.target_id]).filter(Boolean)); }
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

  const rankBadge = (r: string) => r === "owner" ? <span className="text-[10px] rounded bg-amber-500/20 text-amber-600 px-1.5 py-0.5 font-bold">مالك</span>
    : r === "admin" ? <span className="text-[10px] rounded bg-blue-500/20 text-blue-600 px-1.5 py-0.5 font-bold">مسؤول</span>
    : r === "moderator" ? <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 font-bold">مشرف</span>
    : <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">عضو</span>;

  const showAdminTabs = canModerate;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full max-h-[85vh] overflow-hidden rounded-t-3xl bg-card flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> إعدادات الغرفة</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 border-b border-border px-3">
          <button onClick={() => setTab("members")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === "members" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            <Users className="h-4 w-4" /> الأعضاء
          </button>
          
          {showAdminTabs && (
            <button onClick={() => setTab("bans")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === "bans" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <Ban className="h-4 w-4" /> الحظر
            </button>
          )}
          
          {showAdminTabs && (
            <button onClick={() => setTab("logs")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <FileText className="h-4 w-4" /> السجل
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === "members" && (
            <ul className="space-y-2">
              {members.map((m) => {
                const p = userMap[m.user_id];
                return (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-xl bg-background p-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold overflow-hidden">
                      {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p?.username?.[0] ?? "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{p?.username ?? "..."}</span>
                        {rankBadge(m.rank)}
                      </div>
                    </div>
                    {canModerate && m.user_id !== ownerId && (
                      <MemberMenu
                        myRank={myRank}
                        rank={m.rank}
                        onMakeAdmin={() => setRank(m.user_id, "admin", "تمت الترقية إلى مسؤول")}
                        onMakeModerator={() => setRank(m.user_id, "moderator", "تمت الترقية إلى مشرف")}
                        onMakeMember={() => setRank(m.user_id, "member", "تم التخفيض إلى عضو")}
                        onKick={() => kick(m.user_id)}
                        onBan={() => ban(m.user_id)}
                      />
                    )}
                  </li>
                );
              })}
              {members.length === 0 && <li className="text-center text-sm text-muted-foreground py-8">لا يوجد أعضاء</li>}
            </ul>
          )}

          {showAdminTabs && tab === "bans" && (
            <ul className="space-y-2">
              {bans.map((b) => {
                const p = userMap[b.user_id];
                return (
                  <li key={b.user_id} className="flex items-center gap-3 rounded-xl bg-background p-3">
                    <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><Ban className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p?.username ?? "..."}</div>
                      {b.reason && <div className="text-xs text-muted-foreground truncate">{b.reason}</div>}
                    </div>
                    {canModerate && (
                      <button onClick={() => unban(b.user_id)} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">إلغاء الحظر</button>
                    )}
                  </li>
                );
              })}
              {bans.length === 0 && <li className="text-center text-sm text-muted-foreground py-8">لا يوجد محظورون</li>}
            </ul>
          )}

          {showAdminTabs && tab === "logs" && (
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
                  <li key={l.id} className="rounded-xl bg-background p-3 text-sm">
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
        </div>
      </div>
    </div>
  );
}

function MemberMenu({ myRank, rank, onMakeAdmin, onMakeModerator, onMakeMember, onKick, onBan }: {
  myRank: Rank | null; rank: Rank;
  onMakeAdmin: () => void; onMakeModerator: () => void; onMakeMember: () => void;
  onKick: () => void; onBan: () => void;
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
  // moderator can only act on members; admin/owner can act on admin/moderator/member
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