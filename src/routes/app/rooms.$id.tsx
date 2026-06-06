import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ArrowRight, Send, Settings as SettingsIcon, LogOut, Users, Loader2,
  ImagePlus, Mic, Square, Play, Pause, Crown, Shield, UserX, Ban,
  ArrowUpCircle, ArrowDownCircle, ScrollText, X, MoreVertical, MessageSquare,
  Smile, Trash2, Pencil, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getEquipped } from "@/lib/equipped";
import { FlyingEffect } from "@/components/FlyingEffect";
import { MusicPlayer } from "@/components/MusicPlayer";
import { BroadcastCard } from "@/components/BroadcastCard";
import { searchTrack, getTrivia } from "@/lib/music.functions";

export const Route = createFileRoute("/app/rooms/$id")({
  component: RoomPage,
});

type MsgType = "text" | "image" | "voice" | "system";
type Msg = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  message_type: MsgType;
  media_url: string | null;
  media_duration_ms: number | null;
  meta: Record<string, unknown> | null;
};
type Room = { id: string; name: string; description: string | null; owner_id: string };
type Profile = { username: string; avatar_url: string | null };
type Rank = "owner" | "admin" | "member";
type Member = { user_id: string; rank: Rank; joined_at: string };
type Ban = { user_id: string; reason: string | null; created_at: string };
type LogEvt = { id: string; actor_id: string | null; target_id: string | null; event: string; created_at: string };
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

const EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [logs, setLogs] = useState<LogEvt[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState<null | "settings" | "members" | "logs" | "bans" | "edit" | "help">(null);
  const [nameColors, setNameColors] = useState<Record<string, string>>({});
  const [actionTarget, setActionTarget] = useState<Member | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [burst, setBurst] = useState<{ id: number; emoji: string; name?: string } | null>(null);

  const myRank: Rank | null = user ? (members.find(m => m.user_id === user.id)?.rank ?? null) : null;
  const isAdminOrOwner = myRank === "owner" || myRank === "admin";

  const ensureProfiles = async (ids: string[]) => {
    const missing = ids.filter(i => i && !profilesMap[i]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", missing);
    if (!data) return;
    setProfilesMap(m => {
      const next = { ...m };
      data.forEach(p => (next[p.id] = { username: p.username, avatar_url: p.avatar_url }));
      return next;
    });
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: roomData, error: rErr } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (rErr || !roomData) { toast.error(t("common.error")); navigate({ to: "/app" }); return; }
      setRoom(roomData);

      const { data: existing } = await supabase.from("room_members").select("user_id").eq("room_id", id).eq("user_id", user.id).maybeSingle();
      if (!existing) {
        const { error: jErr } = await supabase.from("room_members").insert({ room_id: id, user_id: user.id });
        if (jErr) { toast.error(jErr.message ?? t("common.error")); navigate({ to: "/app" }); return; }
        // Welcome bot greets the new arrival
        setTimeout(() => {
          supabase.rpc("room_bot_say", {
            _room: id,
            _text: `🤖 أهلاً بك في ${roomData.name}! اكتب /help لعرض الأوامر والألعاب والموسيقى.`,
            _kind: "bot",
            _meta: {} as never,
          });
        }, 800);
      }
      await Promise.all([loadMessages(), loadMembers(), loadBans(), loadLogs(), loadReactions()]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("room_messages")
      .select("id, user_id, content, created_at, message_type, media_url, media_duration_ms, meta")
      .eq("room_id", id).order("created_at", { ascending: true }).limit(200);
    const msgs: Msg[] = (data ?? []).map(r => ({
      id: r.id, user_id: r.user_id, content: r.content ?? "",
      created_at: r.created_at,
      message_type: (r.message_type as MsgType) ?? "text",
      media_url: r.media_url, media_duration_ms: r.media_duration_ms,
      meta: (r as { meta?: Record<string, unknown> | null }).meta ?? null,
    }));
    setMessages(msgs);
    await ensureProfiles(msgs.map(m => m.user_id).filter((x): x is string => !!x));
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  const loadMembers = async () => {
    const { data } = await supabase.from("room_members").select("user_id, rank, joined_at").eq("room_id", id);
    const list = (data ?? []) as Member[];
    setMembers(list);
    await ensureProfiles(list.map(m => m.user_id));
  };

  const loadBans = async () => {
    const { data } = await supabase.from("room_bans").select("user_id, reason, created_at").eq("room_id", id);
    const list = (data ?? []) as Ban[];
    setBans(list);
    await ensureProfiles(list.map(b => b.user_id));
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from("room_logs").select("id, actor_id, target_id, event, created_at")
      .eq("room_id", id).order("created_at", { ascending: false }).limit(100);
    const list = (data ?? []) as LogEvt[];
    setLogs(list);
    await ensureProfiles(list.flatMap(l => [l.actor_id, l.target_id].filter(Boolean) as string[]));
  };

  const loadReactions = async () => {
    const { data: msgIds } = await supabase.from("room_messages").select("id").eq("room_id", id).limit(500);
    const ids = (msgIds ?? []).map(r => r.id as string);
    if (!ids.length) { setReactions([]); return; }
    const { data } = await supabase
      .from("room_message_reactions")
      .select("id, message_id, user_id, emoji")
      .in("message_id", ids);
    setReactions((data ?? []) as Reaction[]);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const mine = reactions.find(r => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    setPickerFor(null);
    if (mine) {
      await supabase.from("room_message_reactions").delete().eq("id", mine.id);
    } else {
      await supabase.from("room_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const saveRoomEdits = async () => {
    if (!user || !room) return;
    const name = editName.trim();
    if (!name) { toast.error(t("common.error")); return; }
    setSavingRoom(true);
    const { error } = await supabase.from("rooms")
      .update({ name, description: editDesc.trim() || null })
      .eq("id", room.id);
    setSavingRoom(false);
    if (error) { toast.error(error.message); return; }
    setRoom({ ...room, name, description: editDesc.trim() || null });
    toast.success(t("room.action_done"));
    setPanel("settings");
  };

  const deleteRoom = async () => {
    if (!room) return;
    if (!confirm("هل أنت متأكد من حذف الغرفة نهائياً؟")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", room.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الغرفة");
    navigate({ to: "/app" });
  };

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`room:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, async (payload) => {
        const r = payload.new as Record<string, unknown>;
        const m: Msg = {
          id: r.id as string, user_id: (r.user_id as string | null) ?? null,
          content: (r.content as string) ?? "", created_at: r.created_at as string,
          message_type: ((r.message_type as MsgType) ?? "text"),
          media_url: (r.media_url as string | null) ?? null,
          media_duration_ms: (r.media_duration_ms as number | null) ?? null,
          meta: (r.meta as Record<string, unknown> | null) ?? null,
        };
        if (m.user_id) await ensureProfiles([m.user_id]);
        setMessages(old => (old.some(x => x.id === m.id) ? old : [...old, m]));
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 30);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, () => loadMembers())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_bans", filter: `room_id=eq.${id}` }, () => loadBans())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_logs", filter: `room_id=eq.${id}` }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_message_reactions" }, () => loadReactions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Flying entrance effect — broadcast my equipped effect on join, listen for others'
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`room-fx:${id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "enter" }, (msg) => {
      const p = msg.payload as { emoji?: string; name?: string };
      if (p?.emoji) setBurst({ id: Date.now() + Math.random(), emoji: p.emoji, name: p.name });
    }).subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const eq = await getEquipped(user.id);
      if (eq.effect) {
        const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
        ch.send({ type: "broadcast", event: "enter", payload: { emoji: eq.effect.emoji, name: p?.username } });
        setBurst({ id: Date.now(), emoji: eq.effect.emoji, name: p?.username });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);



  // Auto-leave after 30s of being hidden / offline (cancel if user comes back)
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const leaveNow = () => { supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id); };
    const arm = () => { if (timer) return; timer = setTimeout(leaveNow, 30_000); };
    const disarm = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const onVis = () => { document.visibilityState === "hidden" ? arm() : disarm(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", arm);
    window.addEventListener("online", disarm);
    window.addEventListener("pagehide", leaveNow);
    return () => {
      disarm();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", arm);
      window.removeEventListener("online", disarm);
      window.removeEventListener("pagehide", leaveNow);
    };
  }, [id, user]);

  // Resolve name colors for any author seen in messages
  useEffect(() => {
    const ids = Array.from(new Set(messages.map(m => m.user_id).filter((x): x is string => !!x)));
    ids.forEach(uid => {
      if (nameColors[uid] !== undefined) return;
      getEquipped(uid).then(eq => {
        setNameColors(c => ({ ...c, [uid]: eq.name_color?.color ?? "" }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const botSay = async (txt: string, kind = "bot", meta: Record<string, unknown> = {}) => {
    await supabase.rpc("room_bot_say", { _room: id, _text: txt, _kind: kind, _meta: meta as never });
  };


  const runCommand = async (raw: string): Promise<boolean> => {
    if (!raw.startsWith("/")) return false;
    const [cmd, ...rest] = raw.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    const c = cmd.toLowerCase();
    try {
      if (c === "play") {
        if (!arg) { await botSay("استخدم: /play اسم الأغنية"); return true; }
        await botSay(`🔎 يبحث عن: ${arg}`);
        const { track, error } = await searchTrack({ data: { q: arg } });
        if (!track) { await botSay(`❌ لم أجد نتائج (${error ?? "no_results"})`); return true; }
        const me = profilesMap[user!.id]?.username ?? "";
        await supabase.rpc("music_play", { _room: id, _track: { ...track, requester_name: me, requester_id: user!.id } });
      } else if (c === "pause") { await supabase.rpc("music_pause", { _room: id }); }
      else if (c === "resume") { await supabase.rpc("music_resume", { _room: id }); }
      else if (c === "stop") { await supabase.rpc("music_stop", { _room: id }); }
      else if (c === "skip") { await supabase.rpc("music_skip", { _room: id }); }
      else if (c === "volume") {
        const v = Math.max(0, Math.min(100, parseInt(arg, 10) || 70));
        await supabase.rpc("music_set_volume", { _room: id, _vol: v });
        await botSay(`🔊 الصوت: ${v}%`);
      } else if (c === "queue") {
        const { data } = await supabase.from("room_music").select("queue, current").eq("room_id", id).maybeSingle();
        const q = ((data?.queue as Array<{ title: string; artist: string }>) ?? []);
        const cur = data?.current as { title: string; artist: string } | null;
        const lines = [
          cur ? `▶️ الآن: ${cur.title} — ${cur.artist}` : "لا توجد أغنية حالية",
          ...q.map((t, i) => `${i + 1}. ${t.title} — ${t.artist}`),
        ];
        await botSay(lines.join("\n"));
      } else if (c === "nowplaying" || c === "np") {
        const { data } = await supabase.from("room_music").select("current").eq("room_id", id).maybeSingle();
        const cur = data?.current as { title: string; artist: string; requester_name?: string } | null;
        await botSay(cur ? `🎵 ${cur.title} — ${cur.artist}${cur.requester_name ? ` (طلبها ${cur.requester_name})` : ""}` : "لا توجد أغنية الآن");
      } else if (c === "help") {
        await botSay("الأوامر:\n/play <اسم> /pause /resume /stop /skip /queue /nowplaying /volume 0-100\nالألعاب: /roll /coin /8ball <سؤال> /trivia /guess <1-10>");
      } else if (c === "roll") {
        await botSay(`🎲 رميت النرد: ${1 + Math.floor(Math.random() * 6)}`);
      } else if (c === "coin") {
        await botSay(`🪙 ${Math.random() < 0.5 ? "صورة" : "كتابة"}`);
      } else if (c === "8ball") {
        const ans = ["نعم بالتأكيد", "لا أعتقد ذلك", "ربما", "حاول لاحقًا", "بدون شك", "السؤال غامض", "مستبعد جدًا", "الإجابة نعم"];
        await botSay(`🎱 ${ans[Math.floor(Math.random() * ans.length)]}`);
      } else if (c === "guess") {
        const n = parseInt(arg, 10);
        if (!n || n < 1 || n > 10) { await botSay("استخدم: /guess <1-10>"); return true; }
        const secret = 1 + Math.floor(Math.random() * 10);
        await botSay(secret === n ? `🎉 صحيح! الرقم كان ${secret}` : `❌ خطأ. الرقم كان ${secret} وأنت قلت ${n}`);
      } else if (c === "trivia") {
        const { question } = await getTrivia();
        if (!question) { await botSay("تعذر جلب سؤال الآن"); return true; }
        await botSay(`❓ [${question.category}]\n${question.q}\n\nالخيارات: ${question.choices.join(" / ")}\n\nالجواب: ||${question.answer}||`);
      } else {
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ";
      await botSay(`⚠️ ${msg}`);
    }
    return true;
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    if (await runCommand(content)) { setSending(false); return; }
    const { error } = await supabase.from("room_messages").insert({ room_id: id, user_id: user.id, content, message_type: "text" });
    setSending(false);
    if (error) { toast.error(t("common.error")); setText(content); }
  };


  const uploadAndSend = async (blob: Blob, kind: "image" | "voice", durationMs?: number) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = kind === "image" ? (blob.type.split("/")[1] || "jpg") : "webm";
      const path = `${user.id}/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("room-media").upload(path, blob, {
        contentType: blob.type || (kind === "image" ? "image/jpeg" : "audio/webm"), upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
      const { error } = await supabase.from("room_messages").insert({
        room_id: id, user_id: user.id, content: "",
        message_type: kind, media_url: pub.publicUrl, media_duration_ms: durationMs ?? null,
      });
      if (error) throw error;
    } catch (err) { console.error(err); toast.error(t("common.error")); }
    finally { setUploading(false); }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    await uploadAndSend(file, "image");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) recChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const duration = Date.now() - recStartRef.current;
        await uploadAndSend(blob, "voice", duration);
      };
      mediaRecRef.current = mr;
      recStartRef.current = Date.now();
      setRecordSeconds(0);
      recTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
      mr.start();
      setRecording(true);
    } catch { toast.error(t("common.error")); }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  const leaveRoom = async () => {
    if (!user) return;
    await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id);
    navigate({ to: "/app" });
  };

  // Owner / admin actions
  const kick = async (uid: string) => {
    const { error } = await supabase.rpc("kick_room_member", { _room: id, _user: uid });
    if (error) toast.error(error.message); else toast.success(t("room.action_done"));
    setActionTarget(null);
  };
  const ban = async (uid: string) => {
    const { error } = await supabase.rpc("ban_room_member", { _room: id, _user: uid, _reason: undefined });
    if (error) toast.error(error.message); else toast.success(t("room.action_done"));
    setActionTarget(null);
  };
  const unban = async (uid: string) => {
    const { error } = await supabase.from("room_bans").delete().eq("room_id", id).eq("user_id", uid);
    if (error) toast.error(error.message); else toast.success(t("room.action_done"));
  };
  const setRank = async (uid: string, rank: Rank) => {
    const { error } = await supabase.rpc("set_member_rank", { _room: id, _user: uid, _new_rank: rank });
    if (error) toast.error(error.message); else toast.success(t("room.action_done"));
    setActionTarget(null);
  };
  const transferOwner = async (uid: string) => {
    if (!confirm(t("room.transfer_confirm"))) return;
    const { error } = await supabase.rpc("transfer_room_ownership", { _room: id, _new_owner: uid });
    if (error) toast.error(error.message); else toast.success(t("room.action_done"));
    setActionTarget(null);
  };

  if (!room) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("auth.loading")}</div>;
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-background">
      <FlyingEffect burst={burst} />
      <header className="flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate({ to: "/app" })} aria-label={t("common.back")}>
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        <button onClick={() => setPanel("settings")} className="min-w-0 flex-1 text-start">
          <h1 className="truncate text-base font-bold">{room.name}</h1>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="online-dot inline-block h-1.5 w-1.5 rounded-full" />
            {members.length} {t("rooms.members")}
          </div>
        </button>
        <button onClick={() => setPanel("members")} aria-label={t("room.members_title")} className="rounded-full p-2 hover:bg-secondary">
          <Users className="h-5 w-5 text-muted-foreground" />
        </button>
        <button onClick={() => setPanel("settings")} aria-label={t("nav.settings")} className="rounded-full p-2 hover:bg-secondary">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <MusicPlayer roomId={id} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">{t("room.no_messages")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => {
              if (m.message_type === "system") return <SystemMessage key={m.id} m={m} />;
              const mine = m.user_id === user?.id;
              const prev = messages[i - 1];
              const showHeader = !prev || prev.user_id !== m.user_id || prev.message_type === "system";
              const profile = m.user_id ? profilesMap[m.user_id] : undefined;
              const msgReactions = reactions.filter(r => r.message_id === m.id);
              const grouped = new Map<string, { count: number; mine: boolean }>();
              msgReactions.forEach(r => {
                const cur = grouped.get(r.emoji) ?? { count: 0, mine: false };
                cur.count += 1;
                if (r.user_id === user?.id) cur.mine = true;
                grouped.set(r.emoji, cur);
              });
              return (
                <li key={m.id} className={`bubble-in flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <div className="w-9 shrink-0">{showHeader && <Avatar profile={profile} />}</div>
                  <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {showHeader && (
                      <div className={`mb-1 px-1 text-[11px] font-semibold text-muted-foreground ${mine ? "text-end" : ""}`}>
                        {profile?.username ?? "…"}
                      </div>
                    )}
                    <div className="relative group">
                      <MessageBubble m={m} mine={mine} />
                      <button
                        type="button"
                        onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                        className={`absolute -bottom-2 ${mine ? "-left-2" : "-right-2"} flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 focus:opacity-100`}
                        aria-label="إضافة تفاعل"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      {pickerFor === m.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setPickerFor(null)} />
                          <div className={`absolute z-50 ${mine ? "left-0" : "right-0"} top-full mt-1 flex gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg`}>
                            {EMOJIS.map(e => (
                              <button key={e} type="button" onClick={() => toggleReaction(m.id, e)}
                                className="text-xl leading-none transition hover:scale-125">
                                {e}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {grouped.size > 0 && (
                      <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                        {Array.from(grouped.entries()).map(([emoji, info]) => (
                          <button key={emoji} type="button" onClick={() => toggleReaction(m.id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${info.mine ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card"}`}>
                            <span>{emoji}</span><span className="font-semibold">{info.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {recording ? (
        <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm font-medium">{t("room.recording")} {formatTime(recordSeconds)}</span>
          <button onClick={stopRecording} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label={t("room.attach_image")}>
            <ImagePlus className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("room.placeholder")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-foreground" />
          {text.trim() ? (
            <button type="submit" disabled={sending}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label={t("room.send")}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          ) : (
            <button type="button" onClick={startRecording} disabled={uploading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label={t("room.record_voice")}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </form>
      )}

      {/* Settings panel */}
      {panel === "settings" && (
        <SheetWrap onClose={() => setPanel(null)}>
          <h2 className="mb-1 text-lg font-bold">{room.name}</h2>
          {room.description && <p className="mb-4 text-sm text-muted-foreground">{room.description}</p>}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />{members.length} {t("rooms.members")}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <PanelBtn onClick={() => setPanel("members")} icon={<Users className="h-4 w-4" />} label={t("room.members_title")} />
            <PanelBtn onClick={() => setPanel("logs")} icon={<ScrollText className="h-4 w-4" />} label={t("room.logs_title")} />
            {isAdminOrOwner && (
              <PanelBtn onClick={() => setPanel("bans")} icon={<Ban className="h-4 w-4" />} label={t("room.banned_list")} />
            )}
            {myRank === "owner" && (
              <PanelBtn
                onClick={() => { setEditName(room.name); setEditDesc(room.description ?? ""); setPanel("edit"); }}
                icon={<Pencil className="h-4 w-4" />} label="تعديل الغرفة"
              />
            )}
          </div>
          <button onClick={leaveRoom}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 font-semibold text-destructive">
            <LogOut className="h-4 w-4" />{t("room.leave")}
          </button>
          {myRank === "owner" && (
            <button onClick={deleteRoom}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive bg-destructive py-3 font-semibold text-destructive-foreground">
              <Trash2 className="h-4 w-4" />حذف الغرفة نهائياً
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("room.leave_confirm")}</p>
        </SheetWrap>
      )}

      {/* Edit room panel — owner only */}
      {panel === "edit" && myRank === "owner" && (
        <SheetWrap onClose={() => setPanel(null)}>
          <h2 className="mb-4 text-lg font-bold">تعديل الغرفة</h2>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم الغرفة</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60}
            className="mb-4 h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:border-primary" />
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">الوصف</label>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} maxLength={200} rows={3}
            className="mb-5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
          <button onClick={saveRoomEdits} disabled={savingRoom}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {savingRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التغييرات"}
          </button>
        </SheetWrap>
      )}


      {/* Members panel */}
      {panel === "members" && (
        <SheetWrap onClose={() => setPanel(null)}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("room.members_title")}</h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {members
              .slice()
              .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
              .map(m => {
                const p = profilesMap[m.user_id];
                const canAct = isAdminOrOwner && m.user_id !== user?.id && m.rank !== "owner";
                return (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
                    <Avatar profile={p} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p?.username ?? "…"}</div>
                      <div className="text-[11px] text-muted-foreground">{rankLabel(m.rank, t)}</div>
                    </div>
                    {m.rank === "owner" && <Crown className="h-4 w-4 text-yellow-500" />}
                    {m.rank === "admin" && <Shield className="h-4 w-4 text-blue-500" />}
                    {canAct && (
                      <button onClick={() => setActionTarget(m)} className="rounded-full p-2 text-muted-foreground hover:bg-card">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </SheetWrap>
      )}

      {/* Logs panel */}
      {panel === "logs" && (
        <SheetWrap onClose={() => setPanel(null)}>
          <h2 className="mb-3 text-lg font-bold">{t("room.logs_title")}</h2>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("room.no_logs")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {logs.map(l => {
                const actor = l.actor_id ? profilesMap[l.actor_id] : null;
                const target = l.target_id ? profilesMap[l.target_id] : null;
                return (
                  <li key={l.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      {logIcon(l.event)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm">
                        <b>{target?.username ?? actor?.username ?? "…"}</b>{" "}
                        <span className="text-muted-foreground">{t(`log.${l.event}`)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{formatRel(l.created_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetWrap>
      )}

      {/* Bans panel */}
      {panel === "bans" && (
        <SheetWrap onClose={() => setPanel(null)}>
          <h2 className="mb-3 text-lg font-bold">{t("room.banned_list")}</h2>
          {bans.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("room.no_bans")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bans.map(b => {
                const p = profilesMap[b.user_id];
                return (
                  <li key={b.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                    <Avatar profile={p} />
                    <div className="flex-1 truncate font-medium">{p?.username ?? "…"}</div>
                    <button onClick={() => unban(b.user_id)}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      {t("room.unban")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetWrap>
      )}

      {/* Per-member actions */}
      {actionTarget && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={() => setActionTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full rounded-t-3xl bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="mb-4 flex items-center gap-3">
              <Avatar profile={profilesMap[actionTarget.user_id]} />
              <div>
                <div className="font-bold">{profilesMap[actionTarget.user_id]?.username ?? "…"}</div>
                <div className="text-xs text-muted-foreground">{rankLabel(actionTarget.rank, t)}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <ActionBtn
                onClick={() => { const tid = actionTarget.user_id; setActionTarget(null); navigate({ to: "/app/chats/$id", params: { id: tid } }); }}
                icon={<MessageSquare className="h-5 w-5" />} label={t("friends.chat")}
              />
              {actionTarget.rank === "member" && (
                <ActionBtn onClick={() => setRank(actionTarget.user_id, "admin")} icon={<ArrowUpCircle className="h-5 w-5" />} label={t("room.promote")} />
              )}
              {actionTarget.rank === "admin" && myRank === "owner" && (
                <ActionBtn onClick={() => setRank(actionTarget.user_id, "member")} icon={<ArrowDownCircle className="h-5 w-5" />} label={t("room.demote")} />
              )}
              {myRank === "owner" && (
                <ActionBtn onClick={() => transferOwner(actionTarget.user_id)} icon={<Crown className="h-5 w-5" />} label={t("room.transfer")} />
              )}
              <ActionBtn onClick={() => kick(actionTarget.user_id)} icon={<UserX className="h-5 w-5" />} label={t("room.kick")} variant="warn" />
              <ActionBtn onClick={() => ban(actionTarget.user_id)} icon={<Ban className="h-5 w-5" />} label={t("room.ban")} variant="danger" />
              <button onClick={() => setActionTarget(null)} className="mt-2 flex h-11 items-center justify-center rounded-2xl border border-border font-medium">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SheetWrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        {children}
      </div>
    </div>
  );
}

function PanelBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-start hover:bg-secondary">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ActionBtn({ icon, label, onClick, variant }: { icon: React.ReactNode; label: string; onClick: () => void; variant?: "warn" | "danger" }) {
  const cls = variant === "danger"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : variant === "warn"
    ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400"
    : "border-border bg-background";
  return (
    <button onClick={onClick} className={`flex h-12 items-center gap-3 rounded-2xl border px-4 font-medium ${cls}`}>
      {icon}{label}
    </button>
  );
}

function Avatar({ profile }: { profile?: Profile }) {
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />;
  const letter = (profile?.username ?? "?").charAt(0).toUpperCase();
  return <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold">{letter}</div>;
}

function SystemMessage({ m }: { m: Msg }) {
  const kind = (m.meta?.kind as string) ?? "system";
  if (kind === "music_now" || kind === "music_queued") {
    const tr = m.meta?.track as { title: string; artist: string; artwork: string; requester_name?: string } | undefined;
    return (
      <li className="bubble-in flex justify-center">
        <div className="flex max-w-[88%] items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 to-transparent px-3 py-2">
          {tr?.artwork && <img src={tr.artwork} alt="" className="h-12 w-12 rounded-lg object-cover" />}
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-primary">{kind === "music_now" ? "🎵 يشغل الآن" : "➕ في قائمة الانتظار"}</div>
            <div className="truncate text-sm font-semibold">{tr?.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">{tr?.artist}{tr?.requester_name ? ` · ${tr.requester_name}` : ""}</div>
          </div>
        </div>
      </li>
    );
  }
  if (kind === "bot") {
    return (
      <li className="bubble-in flex justify-center">
        <div className="max-w-[88%] rounded-2xl border border-border bg-card px-3 py-2 text-center">
          <div className="mb-0.5 text-[10px] font-bold text-primary">🤖 Bot</div>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</div>
        </div>
      </li>
    );
  }
  // event / generic system
  return (
    <li className="bubble-in flex justify-center">
      <div className="rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {m.content}
      </div>
    </li>
  );
}

function MessageBubble({ m, mine }: { m: Msg; mine: boolean }) {
  const base = `rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground border border-border"}`;
  if (m.message_type === "image" && m.media_url) {
    return (
      <a href={m.media_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl">
        <img src={m.media_url} alt="" className="max-h-72 max-w-[260px] rounded-2xl object-cover" />
      </a>
    );
  }
  if (m.message_type === "voice" && m.media_url) {
    return <div className={base}><VoicePlayer url={m.media_url} durationMs={m.media_duration_ms ?? 0} mine={mine} /></div>;
  }
  return <div className={base}><div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div></div>;
}

function VoicePlayer({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => { const a = audioRef.current; if (!a) return; if (playing) a.pause(); else a.play(); };
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    a.addEventListener("play", onPlay); a.addEventListener("pause", onPause); a.addEventListener("ended", onEnded);
    return () => { a.removeEventListener("play", onPlay); a.removeEventListener("pause", onPause); a.removeEventListener("ended", onEnded); };
  }, []);
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={toggle} className={`flex h-8 w-8 items-center justify-center rounded-full ${mine ? "bg-primary-foreground/20" : "bg-secondary"}`}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex h-1 w-32 items-center">
        <div className={`h-1 w-full rounded-full ${mine ? "bg-primary-foreground/30" : "bg-muted"}`} />
      </div>
      <span className="text-xs opacity-80">{formatTime(Math.round(durationMs / 1000))}</span>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}

function rankOrder(r: Rank): number { return r === "owner" ? 0 : r === "admin" ? 1 : 2; }
function rankLabel(r: Rank, t: (k: string) => string) { return r === "owner" ? t("room.owner") : r === "admin" ? t("room.admin") : t("room.member"); }
function logIcon(evt: string) {
  switch (evt) {
    case "join": return <Users className="h-4 w-4 text-green-500" />;
    case "leave": return <LogOut className="h-4 w-4 text-muted-foreground" />;
    case "kick": return <UserX className="h-4 w-4 text-orange-500" />;
    case "ban": return <Ban className="h-4 w-4 text-destructive" />;
    case "unban": return <X className="h-4 w-4 text-muted-foreground" />;
    case "promote": return <ArrowUpCircle className="h-4 w-4 text-blue-500" />;
    case "demote": return <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />;
    case "transfer": return <Crown className="h-4 w-4 text-yellow-500" />;
    default: return <ScrollText className="h-4 w-4 text-muted-foreground" />;
  }
}
function formatTime(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${r.toString().padStart(2, "0")}`; }
function formatRel(ts: string) {
  const d = new Date(ts).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString();
}
