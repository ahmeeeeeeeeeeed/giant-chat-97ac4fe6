import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ArrowRight, Send, Loader2, ImagePlus, Mic, Square, Play, Pause,
  MoreVertical, Reply, Copy, Trash2, Share2, BellOff, Bell, Ban, X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { tryParseTrackDM, TrackDMPlayer } from "@/components/TrackDMPlayer";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { enqueueMessage } from "@/lib/offline-queue";
import { getOnline } from "@/lib/use-online";

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
  reply_to_id: string | null;
};
type Profile = { id: string; username: string; avatar_url: string | null; last_seen_at: string | null; hide_last_seen: boolean };

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
  const [replyTo, setReplyTo] = useState<DM | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherActivity, setOtherActivity] = useState<"idle" | "typing" | "recording">("idle");
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false); // I blocked them
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ kind: "image" | "voice"; file: Blob; previewUrl: string; durationMs?: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesById = useMemo(() => {
    const m = new Map<string, DM>();
    messages.forEach(x => m.set(x.id, x));
    return m;
  }, [messages]);

  const markRead = async () => {
    if (!user) return;
    await supabase.rpc("dm_mark_read", { _peer: otherId });
  };

  // load profile + messages + block/mute state
  useEffect(() => {
    if (!user) return;
    (async () => {
      const cachedMsgs = await cacheGet<DM[]>(cacheKeys.dmMessages(user.id, otherId));
      const cachedProfile = await cacheGet<Profile>(cacheKeys.profile(otherId));
      if (cachedMsgs) setMessages(cachedMsgs);
      if (cachedProfile) setOther(cachedProfile);
      if (cachedMsgs) setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
      try {
        const [{ data: p }, { data: msgs }, { data: bl }, { data: blMe }, { data: mu }] = await Promise.all([
          supabase.from("profiles").select("id, username, avatar_url, last_seen_at, hide_last_seen").eq("id", otherId).maybeSingle(),
          supabase.from("direct_messages")
            .select("id, sender_id, receiver_id, content, created_at, message_type, media_url, media_duration_ms, reply_to_id")
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
            .order("created_at", { ascending: true }).limit(500),
          supabase.from("dm_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", otherId).maybeSingle(),
          supabase.from("dm_blocks").select("blocker_id").eq("blocker_id", otherId).eq("blocked_id", user.id).maybeSingle(),
          supabase.from("dm_mutes").select("muted_id").eq("muter_id", user.id).eq("muted_id", otherId).maybeSingle(),
        ]);
        if (p) { setOther(p as Profile); await cacheSet(cacheKeys.profile(otherId), p as Profile); }
        const fresh = (msgs ?? []) as DM[];
        setMessages(fresh);
        await cacheSet(cacheKeys.dmMessages(user.id, otherId), fresh);
        setBlocked(!!bl);
        setBlockedByOther(!!blMe);
        setMuted(!!mu);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        await markRead();
      } catch {
        // offline — keep cached values
      }
    })();
  }, [otherId, user]);

  // realtime: messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-msg:${[user.id, otherId].sort().join(":")}`)
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
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, (payload) => {
        const r = payload.old as { id: string };
        setMessages(old => old.filter(x => x.id !== r.id));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const r = payload.new as DM;
        setMessages(old => old.map(x => x.id === r.id ? r : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, otherId]);

  // presence + typing channel (shared by both peers — same name)
  useEffect(() => {
    if (!user) return;
    const room = `dm-presence:${[user.id, otherId].sort().join(":")}`;
    const ch = supabase.channel(room, { config: { presence: { key: user.id } } });
    presenceChRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>;
      setOtherOnline(!!state[otherId]?.length);
    });
    ch.on("broadcast", { event: "typing" }, (msg) => {
      const from = (msg.payload as { from: string; kind: "typing" | "recording" | "idle" }).from;
      const kind = (msg.payload as { from: string; kind: "typing" | "recording" | "idle" }).kind;
      if (from === otherId) setOtherActivity(kind);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
    });

    return () => { supabase.removeChannel(ch); presenceChRef.current = null; };
  }, [user, otherId]);

  const broadcastActivity = (kind: "typing" | "recording" | "idle") => {
    if (!user || !presenceChRef.current) return;
    presenceChRef.current.send({ type: "broadcast", event: "typing", payload: { from: user.id, kind } });
  };

  const onTextChange = (v: string) => {
    setText(v);
    broadcastActivity("typing");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => broadcastActivity("idle"), 1500);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    if (blocked) { toast.error("لا يمكن المراسلة، لقد قمت بحظر هذا المستخدم"); return; }
    setSending(true);
    const content = text.trim();
    const reply = replyTo;
    setText(""); setReplyTo(null);
    broadcastActivity("idle");

    if (!getOnline()) {
      await enqueueMessage({ kind: "dm", sender_id: user.id, receiver_id: otherId, content });
      const optimistic: DM = {
        id: `q_${Date.now()}`,
        sender_id: user.id, receiver_id: otherId, content,
        created_at: new Date().toISOString(),
        message_type: "text", media_url: null, media_duration_ms: null,
        reply_to_id: reply?.id ?? null,
      };
      setMessages((old) => [...old, optimistic]);
      setSending(false);
      toast.message("تم حفظ الرسالة — ستُرسل عند عودة الإنترنت");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, receiver_id: otherId, content, message_type: "text",
      reply_to_id: reply?.id ?? null,
    });
    setSending(false);
    if (error) {
      if (!getOnline() || /network|fetch|Failed/i.test(error.message ?? "")) {
        await enqueueMessage({ kind: "dm", sender_id: user.id, receiver_id: otherId, content });
        toast.message("تم حفظ الرسالة — ستُرسل عند عودة الإنترنت");
        return;
      }
      if (error.message?.includes("recipient_dm_locked")) toast.error("هذا المستخدم قفل الرسائل الخاصة (متاح للأصدقاء فقط)");
      else if (error.message?.includes("dm_blocked")) toast.error("لا يمكن إرسال الرسالة (حظر)");
      else toast.error(t("common.error"));
      setText(content); setReplyTo(reply);
    } else {
      toast.success("تم إرسال الرسالة");
    }
  };

  const uploadAndSend = async (blob: Blob, kind: "image" | "voice", durationMs?: number) => {
    if (!user) return;
    if (blocked) { toast.error("لا يمكن المراسلة، لقد قمت بحظر هذا المستخدم"); return; }
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
        reply_to_id: replyTo?.id ?? null,
      });
      if (error) throw error;
      setReplyTo(null);
      toast.success(kind === "image" ? "تم رفع الصورة بنجاح" : "تم إرسال الرسالة الصوتية");
    } catch (err) {
      console.error(err);
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("dm_blocked")) toast.error("لا يمكن إرسال الرسالة (حظر)");
      else if (msg.includes("recipient_dm_locked")) toast.error("هذا المستخدم قفل الرسائل الخاصة");
      else toast.error(t("common.error"));
    }
    finally { setUploading(false); }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الحد الأقصى 5 ميجابايت"); return; }
    const previewUrl = URL.createObjectURL(file);
    setPendingMedia({ kind: "image", file, previewUrl });
  };

  const confirmPendingMedia = async () => {
    if (!pendingMedia || !user) return;
    setUploading(true);
    await uploadAndSend(pendingMedia.file, pendingMedia.kind, pendingMedia.durationMs);
    URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
    setUploading(false);
  };

  const cancelPendingMedia = () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
  };

  const startRecording = async () => {
    if (blocked) { toast.error("تم حظر المستخدم"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) recChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop());
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const duration = Date.now() - recStartRef.current;
        broadcastActivity("idle");
        await uploadAndSend(blob, "voice", duration);
      };
      mediaRecRef.current = mr;
      recStartRef.current = Date.now();
      setRecordSeconds(0);
      recTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
      mr.start();
      setRecording(true);
      broadcastActivity("recording");
    } catch { toast.error("تعذر الوصول إلى الميكروفون"); }
  };
  const stopRecording = () => {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  // message actions
  const copyMessage = async (m: DM) => {
    const txt = m.content || m.media_url || "";
    try { await navigator.clipboard.writeText(txt); toast.success("تم النسخ"); }
    catch { toast.error(t("common.error")); }
    setMenuFor(null);
  };
  const deleteForMe = async (m: DM) => {
    setMenuFor(null);
    const { error } = await supabase.rpc("dm_delete_for_me", { _id: m.id });
    if (error) { toast.error(t("common.error")); return; }
    setMessages(old => old.filter(x => x.id !== m.id));
    toast.success("تم الحذف لديك");
  };
  const deleteForAll = async (m: DM) => {
    setMenuFor(null);
    const { error } = await supabase.rpc("dm_delete_for_all", { _id: m.id });
    if (error) { toast.error(t("common.error")); return; }
    toast.success("تم حذف الرسالة للجميع");
  };
  const shareMessage = async (m: DM) => {
    setMenuFor(null);
    const txt = m.content || m.media_url || "";
    if (navigator.share) {
      try { await navigator.share({ text: txt }); } catch { /* user canceled */ }
    } else {
      try { await navigator.clipboard.writeText(txt); toast.success("تم النسخ للمشاركة"); }
      catch { toast.error(t("common.error")); }
    }
  };

  // mute / block toggles
  const toggleMute = async () => {
    if (!user) return;
    if (muted) {
      await supabase.from("dm_mutes").delete().eq("muter_id", user.id).eq("muted_id", otherId);
      setMuted(false); toast.success("تم إلغاء كتم المحادثة");
    } else {
      await supabase.from("dm_mutes").insert({ muter_id: user.id, muted_id: otherId });
      setMuted(true); toast.success("تم كتم المحادثة");
    }
  };
  const toggleBlock = async () => {
    if (!user) return;
    if (blocked) {
      await supabase.from("dm_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", otherId);
      setBlocked(false); toast.success("تم إلغاء الحظر");
    } else {
      if (!confirm("هل تريد فعلاً حظر هذا المستخدم؟ لن تتمكنا من تبادل الرسائل.")) return;
      await supabase.from("dm_blocks").insert({ blocker_id: user.id, blocked_id: otherId });
      setBlocked(true); toast.success("تم حظر المستخدم");
    }
  };

  const presenceLabel = (() => {
    if (otherActivity === "typing") return "يكتب الآن…";
    if (otherActivity === "recording") return "يسجل رسالة صوتية…";
    if (otherOnline) return "متصل الآن";
    if (other?.hide_last_seen) return "آخر ظهور مخفي";
    if (other?.last_seen_at) return `آخر ظهور ${relativeTime(other.last_seen_at)}`;
    return "غير متصل";
  })();

  const [menuOpen, setMenuOpen] = useState(false);

  // Function to navigate to profile
  const goToProfile = () => {
    navigate({ to: "/app/profile/$id", params: { id: otherId } });
  };

  return (
    <main className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* HEADER - MODIFIED: avatar, username, and status are now clickable */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-primary/20 bg-primary text-primary-foreground px-3 py-3 shadow-sm">
        <button onClick={() => navigate({ to: "/app/chats" })} aria-label="رجوع" className="p-1.5 rounded-full hover:bg-primary-foreground/10">
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        
        {/* Clickable Avatar */}
        <button 
          onClick={goToProfile}
          className="focus:outline-none"
          aria-label="عرض البروفايل"
        >
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-primary-foreground/30 transition-transform active:scale-95" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20 font-bold transition-transform active:scale-95">
              {(other?.username ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </button>
        
        {/* Clickable Username and Status */}
        <button 
          onClick={goToProfile}
          className="min-w-0 flex-1 text-left focus:outline-none"
          aria-label="عرض البروفايل"
        >
          <h1 className="truncate text-base font-bold leading-tight hover:underline">
            {other?.username ?? "…"}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] opacity-90">
            {(otherOnline || otherActivity !== "idle") && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            )}
            <span className="truncate">{presenceLabel}</span>
          </div>
        </button>
        
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)} aria-label="القائمة" className="p-1.5 rounded-full hover:bg-primary-foreground/10">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute end-0 top-full mt-2 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lg">
                {/* View Profile option in menu */}
                <button 
                  onClick={() => { 
                    setMenuOpen(false); 
                    goToProfile();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-secondary text-start"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  عرض البروفايل
                </button>
                <button onClick={() => { setMenuOpen(false); toggleMute(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-secondary text-start">
                  {muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {muted ? "إلغاء الكتم" : "كتم المحادثة"}
                </button>
                <button onClick={() => { setMenuOpen(false); toggleBlock(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-secondary text-start text-destructive">
                  <Ban className="h-4 w-4" />
                  {blocked ? "إلغاء الحظر" : "حظر المستخدم"}
                </button>
                <button onClick={() => { setMenuOpen(false); toast.success("تم إرسال البلاغ"); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-secondary text-start">
                  <Share2 className="h-4 w-4" />
                  الإبلاغ عن المستخدم
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {blockedByOther && (
        <div className="bg-destructive/10 text-destructive text-center text-xs py-2 px-3">قام هذا المستخدم بحظرك</div>
      )}
      {blocked && (
        <div className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-center text-xs py-2 px-3">لقد قمت بحظر هذا المستخدم</div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">ابدأ المحادثة بإرسال رسالة 👋</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map(m => {
              const mine = m.sender_id === user?.id;
              const replied = m.reply_to_id ? messagesById.get(m.reply_to_id) : null;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-end gap-1.5 max-w-[85%] ${mine ? "flex-row" : "flex-row-reverse"}`}>
                    {/* Dots button as a sibling — never covers message text */}
                    <div className="relative shrink-0 self-center">
                      <button
                        onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition"
                        aria-label="خيارات الرسالة"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuFor === m.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                          <div className={`absolute z-50 mt-1 ${mine ? "left-0" : "right-0"} top-full w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg`}>
                            <ActionItem icon={<Reply className="h-4 w-4" />} label="رد" onClick={() => { setReplyTo(m); setMenuFor(null); }} />
                            {m.message_type === "text" && (
                              <ActionItem icon={<Copy className="h-4 w-4" />} label="نسخ" onClick={() => copyMessage(m)} />
                            )}
                            <ActionItem icon={<Share2 className="h-4 w-4" />} label="مشاركة" onClick={() => shareMessage(m)} />
                            <ActionItem icon={<Trash2 className="h-4 w-4" />} label="حذف لدي فقط" onClick={() => deleteForMe(m)} />
                            {mine && (
                              <ActionItem icon={<Trash2 className="h-4 w-4 text-destructive" />} label="حذف لدى الجميع" onClick={() => deleteForAll(m)} destructive />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <MessageBubble m={m} mine={mine} replied={replied ?? null} />
                      <div className={`mt-1 text-[10px] text-muted-foreground/80 ${mine ? "text-end" : "text-start"}`} suppressHydrationWarning>
                        {formatDateTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {replyTo && (
        <div className="border-t border-border bg-secondary/60 px-3 py-2 flex items-center gap-2">
          <Reply className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-bold text-primary">رد على</div>
            <div className="truncate text-muted-foreground">{replyTo.content || (replyTo.message_type === "image" ? "صورة" : "رسالة صوتية")}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      {recording ? (
        <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-border bg-card px-3 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm font-medium">جاري التسجيل… {formatTime(recordSeconds)}</span>
          <button onClick={stopRecording} className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-card px-3 py-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.625rem)" }}>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || blocked || blockedByOther}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-50" aria-label="صورة">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
          <input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={blocked || blockedByOther}
            placeholder={blocked || blockedByOther ? "لا يمكن المراسلة" : "اكتب رسالة…"}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-primary disabled:opacity-50"
          />
          {text.trim() ? (
            <button type="submit" disabled={sending || blocked || blockedByOther}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          ) : (
            <button type="button" onClick={startRecording} disabled={blocked || blockedByOther}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="رسالة صوتية">
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </main>
  );
}

function ActionItem({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary text-start ${destructive ? "text-destructive" : ""}`}>
      {icon} {label}
    </button>
  );
}

function MessageBubble({ m, mine, replied }: { m: DM; mine: boolean; replied: DM | null }) {
  const base = `rounded-2xl px-3.5 py-2 shadow-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card border border-border"}`;
  const replyBlock = replied && (
    <div className={`mb-1 rounded-lg border-s-2 px-2 py-1 text-[11px] ${mine ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-secondary"}`}>
      <div className="font-bold opacity-80">رد</div>
      <div className="truncate opacity-90">{replied.content || (replied.message_type === "image" ? "صورة" : "رسالة صوتية")}</div>
    </div>
  );
  if (m.message_type === "image" && m.media_url) {
    return (
      <div className="overflow-hidden rounded-2xl">
        {replyBlock}
        <a href={m.media_url} target="_blank" rel="noreferrer">
          <img src={m.media_url} alt="" className="max-h-72 w-full rounded-2xl object-cover" loading="lazy" />
        </a>
      </div>
    );
  }
  if (m.message_type === "voice" && m.media_url) {
    return <div className={base}>{replyBlock}<VoicePlayer url={m.media_url} durationMs={m.media_duration_ms ?? 0} mine={mine} /></div>;
  }
  const shared = tryParseTrackDM(m.content || "");
  if (shared) {
    return <div className={base}>{replyBlock}<TrackDMPlayer track={shared.track} senderName={shared.senderName} mine={mine} /></div>;
  }
  return <div className={base}>{replyBlock}<div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div></div>;
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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("ar", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${date} · ${time}`;
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "قبل لحظات";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}