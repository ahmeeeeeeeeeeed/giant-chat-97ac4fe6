import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Send, Loader2, ImagePlus, Mic, Square, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/chats/$id")({
  component: DMPage,
});

type DM = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  message_type: "text" | "image" | "voice";
  media_url: string | null;
  media_duration_ms: number | null;
};
type Profile = { id: string; username: string; avatar_url: string | null };

function DMPage() {
  const { id: otherId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<DM[]>([]);
  const [other, setOther] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markRead = async () => {
    if (!user) return;
    await supabase.rpc("dm_mark_read", { _peer: otherId });
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).maybeSingle();
      if (p) setOther(p as Profile);
      const { data } = await supabase
        .from("direct_messages")
        .select("id, sender_id, receiver_id, content, created_at, message_type, media_url, media_duration_ms")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(300);
      setMessages((data ?? []) as DM[]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
      await markRead();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId, user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm:${user.id}:${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const r = payload.new as DM;
        if (
          (r.sender_id === user.id && r.receiver_id === otherId) ||
          (r.sender_id === otherId && r.receiver_id === user.id)
        ) {
          setMessages((old) => (old.some(x => x.id === r.id) ? old : [...old, r]));
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 30);
          if (r.receiver_id === user.id) markRead();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, otherId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, receiver_id: otherId, content, message_type: "text",
    });
    setSending(false);
    if (error) { toast.error(t("common.error")); setText(content); }
  };

  const uploadAndSend = async (blob: Blob, kind: "image" | "voice", durationMs?: number) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = kind === "image" ? (blob.type.split("/")[1] || "jpg") : "webm";
      const path = `${user.id}/dm/${otherId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("room-media").upload(path, blob, {
        contentType: blob.type || (kind === "image" ? "image/jpeg" : "audio/webm"), upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id, receiver_id: otherId, content: "",
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
        stream.getTracks().forEach(tr => tr.stop());
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

  return (
    <main className="fixed inset-0 z-50 flex flex-col bg-background" style={{ height: "100dvh", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate({ to: "/app/chats" })} aria-label={t("common.back")}>
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        {other?.avatar_url ? (
          <img src={other.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold">
            {(other?.username ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{other?.username ?? "…"}</h1>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("room.no_messages")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map(m => {
              const mine = m.sender_id === user?.id;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <MessageBubble m={m} mine={mine} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {recording ? (
        <div className="flex items-center gap-3 border-t border-border bg-card px-3 py-3">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm font-medium">{t("room.recording")} {formatTime(recordSeconds)}</span>
          <button onClick={stopRecording} className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-50" aria-label={t("room.attach_image")}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("room.placeholder")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-foreground" />
          {text.trim() ? (
            <button type="submit" disabled={sending}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          ) : (
            <button type="button" onClick={startRecording}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={t("room.record_voice")}>
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </main>
  );
}

function MessageBubble({ m, mine }: { m: DM; mine: boolean }) {
  const base = `max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card border border-border"}`;
  if (m.message_type === "image" && m.media_url) {
    return (
      <a href={m.media_url} target="_blank" rel="noreferrer" className="max-w-[78%] overflow-hidden rounded-2xl">
        <img src={m.media_url} alt="" className="max-h-72 w-full rounded-2xl object-cover" />
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

function formatTime(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${r.toString().padStart(2, "0")}`; }
