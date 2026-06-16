import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Send, Loader2, ArrowLeft, Users, Hash, Lock, Settings, Shield, Ban, UserMinus,
  ArrowUp, ArrowDown, Crown, FileText, X, KeyRound, MoreVertical, Megaphone,
  UserPlus, AtSign, Edit3, Trash2, Power, Globe, Search, Info, Save, AlertTriangle,
  Image as ImageIcon, Mic, Square, Play, Pause, Share2, Copy, Bot, Gift,
} from "lucide-react";
import { MusicPlayer } from "@/components/MusicPlayer";
import { BroadcastCard } from "@/components/BroadcastCard";
import { SharePostModal, SharedPostCard } from "@/components/SharePostModal";
import { RoomEntryEffect, type EntryBurst, type EntryEffectType, pickRandomEffect } from "@/components/RoomEntryEffect";
import { GiftPickerModal } from "@/components/GiftPicker";
import { GiftEffectOverlay, type GiftBurst } from "@/components/GiftEffectOverlay";
import { getEquipped } from "@/lib/equipped";
import { markRoomSeen } from "@/lib/notify";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ensureMediaLibraryPermission } from "@/lib/app-permissions";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { getOnline, useOnline } from "@/lib/use-online";
import { UserBadgesInline } from "@/components/UserBadges";
import { StoryRing } from "@/components/StoryRing";

type Rank = "owner" | "admin" | "moderator" | "member";

export const Route = createFileRoute("/app/rooms/$id")({
  component: RoomPage,
});

function RoomPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [colorMap, setColorMap] = useState<Record<string, { name?: string; chat?: string }>>({});
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
  const [showBots, setShowBots] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [giftPreset, setGiftPreset] = useState<string | null>(null);
  const [giftBurst, setGiftBurst] = useState<GiftBurst | null>(null);
  const [announceText, setAnnounceText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [actionMsg, setActionMsg] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);

  const scrollToBottom = (smooth = false) => {
    const el = messagesEndRef.current;
    if (!el) return;
    const go = () => el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    go();
    requestAnimationFrame(() => { go(); requestAnimationFrame(go); });
    setTimeout(go, 120);
    setTimeout(go, 350);
    setTimeout(go, 800);
  };
  const [entryBurst, setEntryBurst] = useState<EntryBurst | null>(null);
  const entryChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ kind: "image" | "voice"; file: Blob; previewUrl: string; durationMs?: number } | null>(null);

  const userMapRef = useRef<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => { userMapRef.current = userMap; }, [userMap]);

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const need = Array.from(new Set(ids.filter((id) => id && !userMapRef.current[id])));
    if (need.length === 0) return;
    // Batch fetch: profiles + their equipped shop items in 2 queries total
    // (was N+1 per user before, causing slow room load with many senders).
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, equipped_name_color, equipped_chat_color")
      .in("id", need);
    if (!profs || !profs.length) return;
    setUserMap((prev) => {
      const next = { ...prev };
      profs.forEach((p: any) => { next[p.id] = { username: p.username, avatar_url: p.avatar_url }; });
      return next;
    });
    const itemIds = Array.from(new Set(
      profs.flatMap((p: any) => [p.equipped_name_color, p.equipped_chat_color]).filter(Boolean)
    )) as string[];
    const itemMap: Record<string, any> = {};
    if (itemIds.length) {
      const { data: items } = await supabase.from("shop_items").select("id,payload").in("id", itemIds);
      (items ?? []).forEach((it: any) => { itemMap[it.id] = it; });
    }
    setColorMap((prev) => {
      const next = { ...prev };
      profs.forEach((p: any) => {
        const nc = p.equipped_name_color ? itemMap[p.equipped_name_color]?.payload?.color : undefined;
        const cc = p.equipped_chat_color ? itemMap[p.equipped_chat_color]?.payload?.color : undefined;
        next[p.id] = { name: nc, chat: cc };
      });
      return next;
    });
  }, []);

  const loadRoom = async () => {
    const { data, error } = await supabase.from("rooms").select("id, name, description, owner_id, created_at, type, max_members, is_active, background_url, background_type").eq("id", roomId).maybeSingle();
    if (error) {
      // Network/RLS hiccup — keep loading state, don't navigate away.
      console.error("loadRoom error", error);
      return;
    }
    if (!data) {
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
    if (meta?.kind === "gift" || meta?.kind === "gift_global") return false;
    if ((m?.content ?? "").startsWith("📢")) return false;
    return true;
  };

  const loadMessages = async () => {
    // 1) Local-first: render cached messages immediately (works fully offline).
    const cached = await cacheGet<any[]>(cacheKeys.roomMessages(roomId));
    if (cached && cached.length) {
      setMessages(cached);
      const ids = cached.map((m: any) => m.user_id).filter(Boolean);
      ensureProfiles(ids);
      scrollToBottom(didInitialScrollRef.current);
      didInitialScrollRef.current = true;
    }
    // 2) Skip network when offline — avoids browser errors and keeps cached UI.
    if (!getOnline()) return;
    // 3) Background sync from cloud.
    const { data: raw } = await supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50);
    const data = raw ? [...raw].reverse() : null;
    if (data) {
      const visible = data.filter((m: any) => !isPlainSystem(m));
      setMessages(visible);
      const ids = visible.map((m: any) => m.user_id).filter(Boolean);
      ensureProfiles(ids);
      scrollToBottom(didInitialScrollRef.current);
      didInitialScrollRef.current = true;
    }
  };

  // Persist room messages locally on every change (offline-first cache).
  useEffect(() => {
    if (!roomId) return;
    // Don't persist optimistic tmp-* items; keep cache to confirmed messages.
    const persistable = messages.filter((m: any) => typeof m.id === "string" && !m.id.startsWith("tmp-"));
    if (persistable.length) void cacheSet(cacheKeys.roomMessages(roomId), persistable);
  }, [messages, roomId]);

  useEffect(() => {
    if (!user?.id) return; // wait for auth so RLS allows reads
    loadRoom();
    checkBanned();
    loadMembership();
    loadMemberCount();
    loadMessages();
    ensureProfiles([user.id]);
    markRoomSeen(roomId);


    const ch = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (p) => {
          const m: any = p.new;
          // Trigger gift burst overlay for gift system messages
          const gmeta = m?.meta as any;
          if ((gmeta?.kind === "gift" || gmeta?.kind === "gift_global") && gmeta?.emoji) {
            setGiftBurst({
              id: String(m.id),
              emoji: gmeta.emoji,
              giftName: gmeta.gift_name ?? "هدية",
              senderName: gmeta.sender_name,
              receiverName: gmeta.receiver_name,
              effectType: (gmeta.effect_type as any) ?? "overlay",
              isGlobal: gmeta.kind === "gift_global" || gmeta.scope === "global",
            });
          }
          // Plain system messages float as a transient notice instead of
          // joining the chat history.
          if (isPlainSystem(m)) {
            toast(m.content ?? "", { duration: 4000 });
            markRoomSeen(roomId);
            return;
          }
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            // Replace any matching optimistic temp message from the same sender
            const tmpIdx = prev.findIndex((x) =>
              typeof x.id === "string" && x.id.startsWith("tmp-") &&
              x.user_id === m.user_id &&
              (x.content ?? "") === (m.content ?? "") &&
              (x.media_url ?? null) === (m.media_url ?? null)
            );
            if (tmpIdx >= 0) {
              const next = prev.slice();
              next[tmpIdx] = m;
              return next;
            }
            return [...prev, m];
          });
          if (m.user_id) ensureProfiles([m.user_id]);
          markRoomSeen(roomId);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (p) => {
          const old: any = p.old;
          if (!old?.id) return;
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => { loadMemberCount(); loadMembership(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => setRoom(p.new))
      .subscribe();

    const entryCh = supabase
      .channel(`room-entry:${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "entry" }, (p) => {
        const payload = (p.payload ?? {}) as { effectType?: EntryEffectType; name?: string };
        const type: EntryEffectType = payload.effectType ?? pickRandomEffect();
        setEntryBurst({ id: Date.now() + Math.random(), type, name: payload.name });
      })
      .subscribe();
    entryChRef.current = entryCh;

    // Fallback channel: some system rows (gifts/music) are written via
    // SECURITY DEFINER RPCs and occasionally don't reach the room_messages
    // realtime subscriber. Listen to the source tables and refetch messages
    // so they appear without needing to leave and re-enter the room.
    const sysCh = supabase
      .channel(`room-sys:${roomId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_transactions", filter: `room_id=eq.${roomId}` },
        () => { loadMessages(); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "room_music", filter: `room_id=eq.${roomId}` },
        () => { loadMessages(); })
      .subscribe();

    return () => {
      markRoomSeen(roomId);
      supabase.removeChannel(ch);
      supabase.removeChannel(entryCh);
      supabase.removeChannel(sysCh);
      entryChRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  // Auto-leave the room when the user goes offline OR signs out.
  // The user must explicitly tap "انضمام للغرفة" again to come back in.
  const online = useOnline();
  useEffect(() => {
    if (!online && myRank) {
      setMyRank(null);
      toast.message("تمت مغادرة الغرفة بسبب فقد الاتصال");
      navigate({ to: "/app" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        // Best-effort: remove room membership so user must re-join after sign-in.
        try {
          if (user?.id) {
            await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
          }
        } catch { /* ignore */ }
        setMyRank(null);
        navigate({ to: "/" });
      }
    });
    return () => { sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  // Auto-leave on app close / tab hide / device lock — uses fetch keepalive
  // so the request survives the unload. User must rejoin manually next time.
  useEffect(() => {
    if (!user?.id || !myRank) return;
    const leaveOnExit = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/room_members?room_id=eq.${roomId}&user_id=eq.${user.id}`;
        const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        // Pull current session token synchronously from storage to attach as bearer.
        let token = apikey;
        try {
          const raw = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
          if (raw) {
            const parsed = JSON.parse(localStorage.getItem(raw) || "null");
            if (parsed?.access_token) token = parsed.access_token;
          }
        } catch { /* ignore */ }
        void fetch(url, {
          method: "DELETE",
          keepalive: true,
          headers: { apikey, Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") leaveOnExit(); };
    window.addEventListener("pagehide", leaveOnExit);
    window.addEventListener("beforeunload", leaveOnExit);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", leaveOnExit);
      window.removeEventListener("beforeunload", leaveOnExit);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, myRank, roomId]);



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
    // Broadcast entry effect: prefer user's equipped entry effect, fallback to random
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, equipped_effect")
        .eq("id", user.id)
        .maybeSingle();
      const name = prof?.username ?? "مستخدم";
      let effectType: EntryEffectType = pickRandomEffect();
      if (prof?.equipped_effect) {
        const { data: item } = await supabase
          .from("shop_items")
          .select("payload")
          .eq("id", prof.equipped_effect)
          .maybeSingle();
        const et = (item?.payload as { entry_type?: string } | null)?.entry_type;
        if (et && ["dragon","princess","knight","magic","mascot","portal"].includes(et)) {
          effectType = et as EntryEffectType;
        }
      }
      setEntryBurst({ id: Date.now(), type: effectType, name });
      entryChRef.current?.send({ type: "broadcast", event: "entry", payload: { effectType, name } });
    } catch { /* ignore */ }
    try { await supabase.rpc("record_daily_action", { _kind: "join_rooms", _amount: 1 }); } catch { /* ignore */ }
  };

  const leaveRoom = async () => setShowLeaveConfirm(true);
  const doLeave = async () => {
    setShowLeaveConfirm(false);
    const { error } = await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user!.id);
    if (error) toast.error("فشل المغادرة");
    else { setMyRank(null); navigate({ to: "/app" }); }
  };

  const insertOptimistic = (m: any) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;
    if (!myRank) { toast.error("يجب الانضمام إلى الغرفة أولاً"); return; }
    if (isBanned) { toast.error("أنت محظور من هذه الغرفة"); return; }
    setSending(true);
    const content = text.trim();
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, room_id: roomId, user_id: user.id, content, message_type: "text", created_at: new Date().toISOString(), meta: null };
    insertOptimistic(optimistic);
    setText("");
    const { data, error } = await supabase.from("room_messages")
      .insert({ room_id: roomId, user_id: user.id, content } as never)
      .select("*").maybeSingle();
    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("فشل إرسال الرسالة");
      setText(content);
      return;
    }
    if (data) setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    try { await supabase.rpc("record_daily_action", { _kind: "send_messages", _amount: 1 }); } catch { /* ignore */ }
  };

  const uploadAndSend = async (file: Blob, kind: "image" | "voice", durationMs?: number) => {
    if (!user) return;
    if (!myRank) { toast.error("يجب الانضمام إلى الغرفة أولاً"); return; }
    if (isBanned) { toast.error("أنت محظور من هذه الغرفة"); return; }
    const ext = kind === "image"
      ? ((file as File).name?.split(".").pop()?.toLowerCase() || "jpg")
      : (file.type.includes("mp4") ? "m4a" : "webm");
    const path = `${user.id}/${roomId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("room-media").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { toast.error(up.error.message || "فشل رفع الملف"); return; }
    const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
    const url = pub.publicUrl;
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId, room_id: roomId, user_id: user.id,
      content: kind === "image" ? "📷 صورة" : "🎤 رسالة صوتية",
      message_type: kind, media_url: url, media_duration_ms: durationMs ?? null,
      created_at: new Date().toISOString(), meta: null,
    };
    insertOptimistic(optimistic);
    const { data, error } = await supabase.from("room_messages").insert({
      room_id: roomId, user_id: user.id,
      content: optimistic.content,
      message_type: kind, media_url: url, media_duration_ms: durationMs ?? null,
    } as never).select("*").maybeSingle();
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("فشل إرسال الوسائط");
      return;
    }
    if (data) setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    try { await supabase.rpc("record_daily_action", { _kind: "send_messages", _amount: 1 }); } catch { /* ignore */ }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("الملف ليس صورة"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("حجم الصورة كبير (حد أقصى 8MB)"); return; }
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

  const openImagePicker = async () => {
    if (!isMember || isBanned || uploading) return;
    const ok = await ensureMediaLibraryPermission();
    if (!ok) { toast.error("صلاحية الصور مطلوبة", { description: "فعّلها من إعدادات التطبيق لاختيار صورة" }); return; }
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    if (recording) return;
    if (!myRank) { toast.error("يجب الانضمام إلى الغرفة أولاً"); return; }
    if (isBanned) { toast.error("أنت محظور من هذه الغرفة"); return; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("المتصفح لا يدعم تسجيل الصوت");
      return;
    }
    let stream: MediaStream;
    try {
      // Call getUserMedia directly in the gesture handler to preserve the
      // user-activation chain (Android WebView / iOS Safari requirement).
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("صلاحية المايكروفون مطلوبة", { description: "فعّلها من إعدادات التطبيق لإرسال رسائل صوتية" });
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        toast.error("لا يوجد ميكروفون متاح على الجهاز");
      } else if (name === "NotReadableError") {
        toast.error("الميكروفون مشغول بواسطة تطبيق آخر");
      } else {
        toast.error("تعذّر الوصول إلى الميكروفون: " + (err?.message || name || ""));
      }
      return;
    }
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) recordChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) { window.clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const duration = Date.now() - recordStartRef.current;
        setRecording(false); setRecordSec(0);
        if (blob.size > 0 && duration > 500) {
          const previewUrl = URL.createObjectURL(blob);
          setPendingMedia({ kind: "voice", file: blob, previewUrl, durationMs: duration });
        }
      };
      recordStartRef.current = Date.now();
      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSec(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSec(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
    } catch (err: any) {
      stream.getTracks().forEach((t) => t.stop());
      toast.error("فشل بدء التسجيل: " + (err?.message || ""));
    }
  };

  const stopRecording = (cancel = false) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (cancel) {
      mr.onstop = () => {
        mr.stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) { window.clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setRecording(false); setRecordSec(0);
        recordChunksRef.current = [];
      };
    }
    try { mr.stop(); } catch { /* ignore */ }
    mediaRecorderRef.current = null;
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

  // Pre-join lobby — the user is NOT inside the room until they tap the
  // join button. Auto-join is intentionally disabled so that going offline
  // or signing out doesn't silently put them back in the room next time.
  if (!isMember) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/20">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary transition" aria-label="رجوع">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-base truncate">{room.name}</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className={`flex h-24 w-24 items-center justify-center rounded-3xl text-white font-extrabold text-4xl shadow-2xl mb-5 ${
            room.type === "private"
              ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
              : "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600"
          }`}>
            {roomInitial}
          </div>
          <div className="flex items-center gap-2 mb-1">
            {room.type === "private" ? <Lock className="h-4 w-4 text-amber-500" /> : <Hash className="h-4 w-4 text-emerald-500" />}
            <h2 className="text-xl font-extrabold">{room.name}</h2>
          </div>
          {room.description && (
            <p className="text-sm text-muted-foreground max-w-md mb-4 whitespace-pre-wrap">{room.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {memberCount}/{room.max_members}</span>
            <span>•</span>
            <span>{room.type === "private" ? "غرفة خاصة" : "غرفة عامة"}</span>
            <span>•</span>
            <span className={room.is_active ? "text-emerald-600" : "text-red-500"}>
              {room.is_active ? "نشطة" : "موقوفة"}
            </span>
          </div>

          {isBanned ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-500 font-bold flex items-center gap-2">
              <Ban className="h-5 w-5" /> أنت محظور من هذه الغرفة
            </div>
          ) : askPassword ? (
            <div className="w-full max-w-sm space-y-3">
              <p className="text-sm text-muted-foreground">هذه غرفة خاصة — أدخل كلمة المرور:</p>
              <input
                type="password" value={joinPw} onChange={(e) => setJoinPw(e.target.value)}
                autoFocus placeholder="كلمة المرور"
                className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-center text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setAskPassword(false); setJoinPw(""); }}
                  className="flex-1 h-12 rounded-2xl border border-border font-semibold"
                >إلغاء</button>
                <button
                  onClick={() => tryJoin(joinPw)} disabled={joining || !joinPw}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
                  دخول
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => tryJoin()} disabled={joining || !room.is_active}
              className="h-14 px-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold text-base shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] disabled:opacity-50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {joining ? "جارٍ الانضمام..." : "انضمام إلى الغرفة"}
            </button>
          )}

          {!online && (
            <p className="mt-4 text-xs text-amber-600">⚠️ تحتاج إلى اتصال بالإنترنت للانضمام</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/20">
      <RoomBackground url={room.background_url} type={room.background_type} />
      <RoomEntryEffect burst={entryBurst} />
      <GiftEffectOverlay burst={giftBurst} />
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
            {isMember && (
              <button onClick={leaveRoom} className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition">
                مغادرة
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
            <ChipBtn icon={<Share2 className="h-3 w-3" />} label="نشر" onClick={() => setShowShare(true)} highlight />
            <ChipBtn icon={<Bot className="h-3 w-3" />} label="البوتات" onClick={() => setShowBots(true)} highlight />
            <ChipBtn icon={<Gift className="h-3 w-3" />} label="هدية" onClick={() => { setGiftPreset(null); setShowGifts(true); }} highlight />
            <ChipBtn icon={<UserPlus className="h-3 w-3" />} label="دعوة" onClick={() => openSettingsAt("invite")} />
            <ChipBtn icon={<Users className="h-3 w-3" />} label={`الأعضاء (${memberCount})`} onClick={() => openSettingsAt("members")} />
            {canModerate && <ChipBtn icon={<Megaphone className="h-3 w-3" />} label="إعلان" onClick={() => setShowAnnounce(true)} highlight />}
            {canModerate && <ChipBtn icon={<Ban className="h-3 w-3" />} label="الحظر" onClick={() => openSettingsAt("bans")} />}
            {canModerate && <ChipBtn icon={<FileText className="h-3 w-3" />} label="السجل" onClick={() => openSettingsAt("logs")} />}
            {isOwner && <ChipBtn icon={<ImageIcon className="h-3 w-3" />} label="خلفية" onClick={() => openSettingsAt("background")} />}
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
              if (meta?.kind === "gift" || meta?.kind === "gift_global") {
                const isG = meta.kind === "gift_global" || meta.scope === "global";
                return (
                  <div key={msg.id} className="flex justify-center my-2 animate-fade-in">
                    <div className={`inline-flex items-center gap-2 max-w-[94%] rounded-full border px-4 py-2 shadow-md ${isG ? "border-amber-400/60 bg-gradient-to-r from-amber-100 via-pink-100 to-fuchsia-100 dark:from-amber-950/50 dark:via-pink-950/50 dark:to-fuchsia-950/50" : "border-pink-400/50 bg-gradient-to-r from-pink-100 to-fuchsia-100 dark:from-pink-950/50 dark:to-fuchsia-950/50"}`}>
                      <span className="text-2xl leading-none">{meta.emoji ?? "🎁"}</span>
                      <p className="text-xs sm:text-sm font-medium leading-tight">
                        {isG && <span className="text-amber-500 me-1">🌍</span>}
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{meta.sender_name}</span>
                        <span className="opacity-90"> أرسل إلى </span>
                        <span className="font-bold text-pink-700 dark:text-pink-300">{meta.receiver_name}</span>
                        <span className="opacity-90"> هدية </span>
                        <span className="font-bold">{meta.gift_name}</span>
                        <span className="ms-1">{meta.emoji ?? "🎁"}</span>
                      </p>
                    </div>
                  </div>
                );
              }
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
            const displayName =
              (isOwn ? userMap[user!.id]?.username : prof?.username) ?? "مستخدم";
            const displayAvatar =
              isOwn ? userMap[user!.id]?.avatar_url : prof?.avatar_url;
            const nameColor = msg.user_id ? colorMap[msg.user_id]?.name : undefined;
            const chatColor = msg.user_id ? colorMap[msg.user_id]?.chat : undefined;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 animate-fade-in ${
                  isOwn ? "flex-row-reverse text-end" : "flex-row text-start"
                }`}
              >
                {msg.user_id && (
                  <button
                    onClick={() => navigate({ to: "/app/profile/$id", params: { id: msg.user_id } })}
                    className="shrink-0 transition active:scale-95"
                    aria-label="عرض البروفايل"
                  >
                    <StoryRing userId={msg.user_id} size="xs">
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt=""
                          className={`h-9 w-9 rounded-full object-cover ring-2 ${
                            isOwn ? "ring-emerald-500/50" : "ring-emerald-500/25"
                          }`}
                        />
                      ) : (
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow ${
                            isOwn
                              ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                              : "bg-gradient-to-br from-emerald-500 to-emerald-700"
                          }`}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </StoryRing>
                  </button>
                )}
                <div className={`flex max-w-[82%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    <button
                      type="button"
                      onClick={() =>
                        msg.user_id &&
                        navigate({ to: "/app/profile/$id", params: { id: msg.user_id } })
                      }
                      className="text-[12px] font-extrabold leading-none hover:underline"
                      style={
                        nameColor
                          ? { color: nameColor, textShadow: `0 0 10px ${nameColor}66` }
                          : { color: isOwn ? "rgb(16 185 129)" : "rgb(5 150 105)" }
                      }
                    >
                      {displayName}
                    </button>
                    {msg.user_id && <UserBadgesInline userId={msg.user_id} size={12} max={3} />}
                    <span className="text-[10px] text-muted-foreground/70" suppressHydrationWarning>
                      {time}
                    </span>
                  </div>
                  {msg.message_type === "image" && msg.media_url ? (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(msg.media_url)}
                      className="mt-1 block overflow-hidden rounded-2xl ring-1 ring-border/40 transition active:scale-[0.98]"
                    >
                      <img
                        src={msg.media_url}
                        alt=""
                        className="max-h-72 w-auto rounded-2xl object-cover"
                      />
                    </button>
                  ) : msg.message_type === "voice" && msg.media_url ? (
                    <audio
                      src={msg.media_url}
                      controls
                      preload="metadata"
                      className="mt-1 h-9 max-w-[240px]"
                    />
                  ) : (
                    <p
                      onClick={() => {
                        const canDelete = isOwn || myRank === "owner" || myRank === "admin";
                        if (canDelete) setActionMsg(msg);
                      }}
                      className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed cursor-pointer"
                      style={chatColor ? { color: chatColor } : undefined}
                    >
                      {msg.content}
                    </p>
                  )}
                </div>
              </div>
            );


          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form onSubmit={sendMessage} className="border-t border-border bg-background/90 backdrop-blur p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        {pendingMedia ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary/50 p-2">
              {pendingMedia.kind === "image" ? (
                <img src={pendingMedia.previewUrl} alt="معاينة" className="max-h-40 rounded-xl object-cover" />
              ) : (
                <audio src={pendingMedia.previewUrl} controls className="h-10 flex-1" />
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={confirmPendingMedia} disabled={uploading}
                className="flex-1 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold shadow-md disabled:opacity-50 transition hover:from-emerald-600 hover:to-emerald-700">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "إرسال"}
              </button>
              <button type="button" onClick={cancelPendingMedia}
                className="flex-1 h-11 rounded-xl border border-border font-medium hover:bg-secondary transition">
                إلغاء
              </button>
            </div>
          </div>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => stopRecording(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:bg-secondary/80 transition" title="إلغاء">
              <X className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-red-500/10 text-red-600 font-bold text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              جارٍ التسجيل · {String(Math.floor(recordSec / 60)).padStart(2, "0")}:{String(recordSec % 60).padStart(2, "0")}
            </div>
            <button type="button" onClick={() => stopRecording(false)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md transition" title="إرسال">
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="submit" disabled={sending || uploading || !text.trim() || !isMember || isBanned}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md disabled:opacity-50 transition hover:from-emerald-600 hover:to-emerald-700"
              title="إرسال">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
            <input value={text} onChange={(e) => setText(e.target.value)}
              placeholder={isMember ? (isBanned ? "أنت محظور" : "اكتب رسالة...") : "يجب الانضمام إلى الغرفة أولاً"} disabled={!isMember || isBanned}
              className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition" />
            <button type="button" onClick={openImagePicker} disabled={!isMember || isBanned || uploading}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 disabled:opacity-50 hover:bg-emerald-500/20 transition" title="إرسال صورة">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
            </button>
            <button type="button" onClick={startRecording} disabled={!isMember || isBanned || uploading}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 disabled:opacity-50 hover:bg-rose-500/20 transition" title="تسجيل صوتي">
              <Mic className="h-5 w-5" />
            </button>
          </div>
        )}
      </form>

      {showShare && <SharePostModal roomId={roomId} onClose={() => setShowShare(false)} />}

      {showBots && <BotCommandsModal onClose={() => setShowBots(false)} />}
      {showGifts && <GiftPickerModal roomId={roomId} onClose={() => setShowGifts(false)} presetReceiverId={giftPreset} />}

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
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Elegant message action sheet */}
      {actionMsg && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => !deleting && setActionMsg(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md mx-3 mb-3 rounded-3xl border border-white/10 bg-slate-900/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-emerald-400/15 backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
          >
            <div className="flex justify-center pt-2.5">
              <span className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pt-3 pb-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/80 mb-1">رسالة</div>
              <div className="line-clamp-2 text-[13.5px] text-white/80">
                {actionMsg.message_type === "image" ? "🖼️ صورة" : actionMsg.message_type === "voice" ? "🎙️ رسالة صوتية" : (actionMsg.content ?? "")}
              </div>
            </div>
            <div className="px-3 pb-3 space-y-2">
              <button
                onClick={async () => {
                  const txt = actionMsg.content || actionMsg.media_url || "";
                  try { await navigator.clipboard.writeText(txt); toast.success("تم النسخ"); }
                  catch { toast.error("تعذّر النسخ"); }
                  setActionMsg(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/8 px-4 py-3.5 text-[15px] font-bold text-white/90 ring-1 ring-white/10 transition active:scale-[0.98] hover:bg-white/12"
              >
                <Copy className="h-4 w-4" />
                <span>نسخ الرسالة</span>
              </button>
              <button
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  const id = actionMsg.id;
                  const { error } = await supabase.from("room_messages").delete().eq("id", id);
                  setDeleting(false);
                  if (error) { toast.error("تعذّر حذف الرسالة: " + error.message); return; }
                  setMessages((prev) => prev.filter((x) => x.id !== id));
                  setActionMsg(null);
                  toast.success("تم حذف الرسالة");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 px-4 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)] ring-1 ring-rose-300/30 transition active:scale-[0.98] hover:from-rose-600 hover:to-rose-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>حذف الرسالة للجميع</span>
              </button>
              <button
                disabled={deleting}
                onClick={() => setActionMsg(null)}
                className="flex w-full items-center justify-center rounded-2xl bg-white/8 px-4 py-3 text-[14px] font-semibold text-white/90 ring-1 ring-white/10 transition active:scale-[0.98] hover:bg-white/12"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
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

type SettingsTab = "members" | "invite" | "bans" | "logs" | "manage" | "background";

function RoomBackground({ url, type }: { url: string | null; type: string | null }) {
  if (!url) return null;
  const isVideo = type === "video";
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {isVideo ? (
        <video src={url} autoPlay loop muted playsInline
          className="h-full w-full object-cover" />
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm dark:bg-background/80" />
    </div>
  );
}

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
          <Tab id="background" icon={<ImageIcon className="h-4 w-4" />} label="خلفية" show={isOwner} />
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
                                <UserBadgesInline userId={m.user_id} size={12} max={3} />
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

          {isOwner && tab === "background" && (
            <BackgroundTab room={room} roomId={roomId} />
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
      max_members: Math.max(2, Math.min(500, Number(maxMembers) || 50)),
      is_active: isActive,
    };
    const { error } = await supabase.from("rooms").update(update).eq("id", roomId);
    if (error) { setSaving(false); toast.error("فشل الحفظ: " + error.message); return; }

    // Password / type changes via secure RPC (owner-only, server-side hashing)
    if (type === "public") {
      await supabase.rpc("set_room_password" as never, { _room: roomId, _password: null } as never);
    } else if (type === "private" && changePw && password.trim()) {
      const { error: pwErr } = await supabase.rpc("set_room_password" as never, { _room: roomId, _password: password.trim() } as never);
      if (pwErr) { setSaving(false); toast.error("فشل ضبط كلمة المرور: " + pwErr.message); return; }
    }
    setSaving(false);
    toast.success("تم حفظ التغييرات");
    setChangePw(false); setPassword("");
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

function BackgroundTab({ room, roomId }: { room: any; roomId: string }) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(room.background_url ?? null);
  const [type, setType] = useState<string | null>(room.background_type ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("الحد الأقصى 15 ميجابايت"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${user.id}/${roomId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("room-backgrounds")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("room-backgrounds")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const u = signed?.signedUrl ?? null;
      if (!u) throw new Error("no_url");
      const t = file.type.startsWith("video") ? "video" : (file.type === "image/gif" ? "gif" : "image");
      setUrl(u); setType(t);
      toast.success("تم الرفع — اضغط حفظ للتطبيق");
    } catch (err: any) {
      toast.error("فشل الرفع: " + (err?.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_room_background" as never, { _room: roomId, _url: url, _type: type } as never);
    setSaving(false);
    if (error) toast.error("فشل: " + error.message);
    else toast.success("تم تطبيق الخلفية على الغرفة");
  };

  const clear = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_room_background" as never, { _room: roomId, _url: null, _type: null } as never);
    setSaving(false);
    if (error) toast.error("فشل: " + error.message);
    else { setUrl(null); setType(null); toast.success("تمت إزالة الخلفية"); }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="relative h-44 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
          {url ? (
            type === "video" ? (
              <video src={url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={url} alt="معاينة" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs">لا توجد خلفية</p>
            </div>
          )}
        </div>
        <div className="p-3 text-[11px] text-muted-foreground">
          معاينة الخلفية كما ستظهر للأعضاء (مع طبقة شفافة فوقها لتسهيل القراءة).
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={onFile} />

      <button onClick={pick} disabled={uploading}
        className="w-full h-12 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-600 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        {uploading ? "جاري الرفع..." : "اختر صورة / GIF / فيديو"}
      </button>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !url}
          className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ وتطبيق
        </button>
        {(room.background_url || url) && (
          <button onClick={clear} disabled={saving}
            className="h-11 px-4 rounded-xl bg-red-500/10 text-red-600 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> إزالة
          </button>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3 text-[11px] text-amber-700 dark:text-amber-300">
        💡 يدعم الصور (JPG/PNG)، الصور المتحركة (GIF)، والفيديوهات القصيرة (MP4/WebM). الحد الأقصى 15 ميجابايت.
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
          {(canManageRanks || (isMod && rank !== "admin" && rank !== "moderator")) && rank !== "member" && (
            <button onClick={() => { setOpen(false); onMakeMember(); }} className={`${item} text-orange-600`}>
              <ArrowDown className="h-4 w-4" /> منح عضوية
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

function BotCommandsModal({ onClose }: { onClose: () => void }) {
  const bots = [
    {
      name: "بوت الترحيب",
      emoji: "👋",
      color: "from-emerald-500 to-teal-600",
      desc: "يرحّب تلقائياً بكل عضو جديد يدخل الغرفة.",
      commands: [
        { trigger: "سلام / مرحبا / هلا / hi / hello", reply: "يرد بتحية ترحيبية" },
        { trigger: "شكراً / مشكور / thanks", reply: "العفو! نحن هنا لخدمتك" },
      ],
    },
    {
      name: "بوت المساعدة",
      emoji: "🛟",
      color: "from-sky-500 to-indigo-600",
      desc: "يعرض قائمة الأوامر المتاحة.",
      commands: [
        { trigger: "مساعدة / help / أوامر", reply: "يعرض قائمة بكل الأوامر" },
      ],
    },
    {
      name: "بوت المسابقات",
      emoji: "🧠",
      color: "from-amber-500 to-orange-600",
      desc: "يطرح أسئلة وألغاز للأعضاء.",
      commands: [
        { trigger: "مسابقة / سؤال / quiz", reply: "يرسل سؤالاً جديداً" },
      ],
    },
    {
      name: "بوت الألعاب",
      emoji: "🎮",
      color: "from-fuchsia-500 to-pink-600",
      desc: "يقترح ألعاباً ممتعة داخل الغرفة.",
      commands: [
        { trigger: "لعب / game / ألعاب", reply: "يقترح ألعاباً للمجموعة" },
      ],
    },
    {
      name: "بوت الإدارة",
      emoji: "🛡️",
      color: "from-rose-500 to-red-600",
      desc: "يعرض أوامر الإدارة للمشرفين.",
      commands: [
        { trigger: "إدارة / admin / مشرف", reply: "يعرض أوامر الإدارة المتاحة" },
      ],
    },
    {
      name: "بوت الردود التلقائية",
      emoji: "💬",
      color: "from-violet-500 to-purple-600",
      desc: "يرد تلقائياً على كلمات مفتاحية شائعة.",
      commands: [
        { trigger: "أي كلمة مفتاحية من القائمة", reply: "رد فوري مناسب" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-8 shadow-2xl sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">أوامر البوتات</h3>
              <p className="text-xs text-muted-foreground">اكتب الأمر في المحادثة وسيرد البوت تلقائياً</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            💡 <strong>كيف تستخدم البوتات؟</strong> فقط اكتب الكلمة المفتاحية في الدردشة وسيرد البوت المناسب تلقائياً خلال ثوانٍ.
          </p>
        </div>

        <div className="space-y-3">
          {bots.map((bot) => (
            <div key={bot.name} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${bot.color} text-white text-lg shadow-sm`}>
                  {bot.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">{bot.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{bot.desc}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {bot.commands.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5">
                    <code className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{c.trigger}</code>
                    <span className="text-[11px] text-muted-foreground">← {c.reply}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
