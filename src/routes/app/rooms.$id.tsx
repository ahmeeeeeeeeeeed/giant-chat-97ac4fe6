import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ArrowRight, Send, Settings as SettingsIcon, LogOut, Users, Loader2,
  ImagePlus, Mic, Square, Play, Pause,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/rooms/$id")({
  component: RoomPage,
});

type Msg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  message_type: "text" | "image" | "voice";
  media_url: string | null;
  media_duration_ms: number | null;
};
type Room = { id: string; name: string; description: string | null; owner_id: string };
type Profile = { username: string; avatar_url: string | null };

function RoomPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles").select("username, avatar_url").eq("id", uid).maybeSingle();
    if (data) setProfilesMap((m) => ({ ...m, [uid]: { username: data.username, avatar_url: data.avatar_url } }));
  };

  // Ensure membership, then load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: roomData, error: rErr } = await supabase
        .from("rooms").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (rErr || !roomData) { toast.error(t("common.error")); navigate({ to: "/app" }); return; }
      setRoom(roomData);

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
      .select("id, user_id, content, created_at, message_type, media_url, media_duration_ms")
      .eq("room_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    const msgs: Msg[] = (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      content: r.content ?? "",
      created_at: r.created_at,
      message_type: (r.message_type as Msg["message_type"]) ?? "text",
      media_url: r.media_url,
      media_duration_ms: r.media_duration_ms,
    }));
    setMessages(msgs);
    const userIds = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, username, avatar_url").in("id", userIds);
      const map: Record<string, Profile> = {};
      profs?.forEach((p) => (map[p.id] = { username: p.username, avatar_url: p.avatar_url }));
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
          const r = payload.new as Record<string, unknown>;
          const m: Msg = {
            id: r.id as string,
            user_id: r.user_id as string,
            content: (r.content as string) ?? "",
            created_at: r.created_at as string,
            message_type: ((r.message_type as Msg["message_type"]) ?? "text"),
            media_url: (r.media_url as string | null) ?? null,
            media_duration_ms: (r.media_duration_ms as number | null) ?? null,
          };
          if (!profilesMap[m.user_id]) await ensureProfile(m.user_id);
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
  }, [id, user]);

  // Auto-leave when app/tab is closed or hidden (best-effort)
  useEffect(() => {
    if (!user) return;
    const leave = () => {
      // fire and forget
      supabase.from("room_members").delete().eq("room_id", id).eq("user_id", user.id);
    };
    const onHide = () => { if (document.visibilityState === "hidden") leave(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [id, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("room_messages")
      .insert({ room_id: id, user_id: user.id, content, message_type: "text" });
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
        contentType: blob.type || (kind === "image" ? "image/jpeg" : "audio/webm"),
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
      const { error } = await supabase.from("room_messages").insert({
        room_id: id, user_id: user.id, content: "",
        message_type: kind, media_url: pub.publicUrl,
        media_duration_ms: durationMs ?? null,
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setUploading(false);
    }
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
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const duration = Date.now() - recStartRef.current;
        await uploadAndSend(blob, "voice", duration);
      };
      mediaRecRef.current = mr;
      recStartRef.current = Date.now();
      setRecordSeconds(0);
      recTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      mr.start();
      setRecording(true);
    } catch {
      toast.error(t("common.error"));
    }
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

  if (!room) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("auth.loading")}</div>;
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate({ to: "/app" })} aria-label={t("common.back")}>
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{room.name}</h1>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="online-dot inline-block h-1.5 w-1.5 rounded-full" />
            {memberCount} {t("rooms.members")}
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} aria-label={t("nav.settings")}>
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">{t("room.no_messages")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const mine = m.user_id === user?.id;
              const prev = messages[i - 1];
              const showHeader = !prev || prev.user_id !== m.user_id;
              const profile = profilesMap[m.user_id];
              return (
                <li key={m.id} className={`bubble-in flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <div className="w-9 shrink-0">
                    {showHeader && <Avatar profile={profile} />}
                  </div>
                  <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {showHeader && !mine && (
                      <div className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">
                        {profile?.username ?? "…"}
                      </div>
                    )}
                    <MessageBubble m={m} mine={mine} />
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label={t("room.attach_image")}
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("room.placeholder")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-foreground"
          />

          {text.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label={t("room.send")}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label={t("room.record_voice")}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </form>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="mb-1 text-lg font-bold">{room.name}</h2>
            {room.description && <p className="mb-4 text-sm text-muted-foreground">{room.description}</p>}
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />{memberCount} {t("rooms.members")}</div>
            <button
              onClick={leaveRoom}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 font-semibold text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t("room.leave")}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("room.leave_confirm")}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function Avatar({ profile }: { profile?: Profile }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  const letter = (profile?.username ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
      {letter}
    </div>
  );
}

function MessageBubble({ m, mine }: { m: Msg; mine: boolean }) {
  const base = `rounded-2xl px-3 py-2 ${
    mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground border border-border"
  }`;
  if (m.message_type === "image" && m.media_url) {
    return (
      <a href={m.media_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl">
        <img src={m.media_url} alt="" className="max-h-72 max-w-[260px] rounded-2xl object-cover" />
      </a>
    );
  }
  if (m.message_type === "voice" && m.media_url) {
    return (
      <div className={base}>
        <VoicePlayer url={m.media_url} durationMs={m.media_duration_ms ?? 0} mine={mine} />
      </div>
    );
  }
  return (
    <div className={base}>
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div>
    </div>
  );
}

function VoicePlayer({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  };
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

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
