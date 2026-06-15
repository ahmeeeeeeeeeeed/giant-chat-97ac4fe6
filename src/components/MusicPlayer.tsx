import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Music2, Pause, Play, SkipForward, X, Volume2, VolumeX, Search,
  Loader2, Share2, ChevronDown, ChevronUp, Lock, Unlock, UserPlus,
  Rewind, FastForward,
} from "lucide-react";
import { searchTrack, type TrackResult } from "@/lib/music.functions";
import { loadYouTubeAPI } from "@/lib/youtube-iframe";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ShareTrackToUserModal } from "@/components/ShareTrackToUserModal";

type Track = {
  videoId?: string;
  title: string;
  artist: string;
  artwork: string;
  preview_url: string;
  duration_ms: number;
  requester_name?: string;
  requester_id?: string;
};

export type RoomMusic = {
  current: Track | null;
  queue: Array<{ title: string; artist: string }>;
  started_at: string | null;
  paused: boolean;
  paused_pos_ms: number;
  volume: number;
};

function fmt(ms: number) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// Extract a YouTube video id from a watch URL when the row was saved before
// the YouTube migration stored it as a separate field.
function extractVideoId(t: Track | null): string | null {
  if (!t) return null;
  if (t.videoId) return t.videoId;
  if (!t.preview_url) return null;
  const m = t.preview_url.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

export function MusicPlayer({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<RoomMusic | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);

  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("room_music")
      .select("current, queue, started_at, paused, paused_pos_ms, volume")
      .eq("room_id", roomId).maybeSingle();
    setState((data as RoomMusic | null) ?? null);
  }, [roomId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`music:${roomId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "room_music", filter: `room_id=eq.${roomId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, load]);

  // Initialize YouTube IFrame player once.
  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !playerHostRef.current) return;
      player = new YT.Player(playerHostRef.current, {
        height: "1", width: "1",
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3 },
        events: {
          onReady: () => { playerRef.current = player; setPlayerReady(true); },
          onStateChange: (e: any) => {
            // 3 = buffering, 1 = playing, 2 = paused, 0 = ended
            setBuffering(e.data === 3);
            if (e.data === 0) {
              void (async () => { try { await supabase.rpc("music_advance_if_ended", { _room: roomId }); } catch { /* ignore */ } })();
            }
          },
          onError: () => {
            toast.error("تعذّر تشغيل هذا المقطع — جاري التخطي");
            void (async () => { try { await supabase.rpc("music_skip", { _room: roomId }); } catch { /* ignore */ } })();
          },
        },
      });
    }).catch((err) => {
      console.error("YT load failed", err);
      toast.error("تعذّر تحميل مشغّل YouTube");
    });
    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      setPlayerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync the shared room state -> player
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !playerReady) return;
    const vid = extractVideoId(state?.current ?? null);
    if (!vid) {
      try { p.stopVideo?.(); } catch { /* ignore */ }
      loadedVideoIdRef.current = null;
      setPosMs(0);
      return;
    }
    const vol = muted ? 0 : Math.max(0, Math.min(100, state?.volume ?? 70));
    try { muted ? p.mute?.() : p.unMute?.(); } catch { /* ignore */ }
    try { p.setVolume?.(vol); } catch { /* ignore */ }

    const startSec = state?.paused
      ? (state.paused_pos_ms / 1000)
      : Math.max(0, ((Date.now() - new Date(state?.started_at ?? Date.now()).getTime()) + (state?.paused_pos_ms ?? 0)) / 1000);

    if (loadedVideoIdRef.current !== vid) {
      loadedVideoIdRef.current = vid;
      try {
        if (state?.paused) {
          p.cueVideoById({ videoId: vid, startSeconds: startSec });
        } else {
          p.loadVideoById({ videoId: vid, startSeconds: startSec });
        }
      } catch (e) { console.error(e); }
      return;
    }
    // same video — apply pause/seek delta
    try {
      const cur = p.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - startSec) > 1.0) p.seekTo(startSec, true);
      if (state?.paused) p.pauseVideo?.();
      else {
        const ps = p.getPlayerState?.();
        // 1 playing, 3 buffering, 5 cued — only call play if not already
        if (ps !== 1 && ps !== 3) {
          const playPromise = p.playVideo?.();
          // Detect blocked autoplay (mobile / no gesture)
          setTimeout(() => {
            const s = p.getPlayerState?.();
            if (s !== 1 && s !== 3) setNeedsGesture(true);
          }, 800);
          // playVideo doesn't return a promise but call defensively
          if (playPromise?.catch) playPromise.catch(() => setNeedsGesture(true));
        }
      }
    } catch (e) { console.error(e); }
  }, [state, muted, playerReady]);

  // Cleanup on unmount handled in init effect.

  // Tick progress
  useEffect(() => {
    if (!state?.current) { setPosMs(0); return; }
    const dur = state.current.duration_ms;
    let raf = 0;
    const tick = () => {
      if (scrubbing !== null) { raf = requestAnimationFrame(tick); return; }
      const p = playerRef.current;
      let pos: number;
      if (state.paused) pos = state.paused_pos_ms;
      else if (p?.getCurrentTime) {
        try { pos = (p.getCurrentTime() || 0) * 1000; } catch { pos = 0; }
        if (pos === 0 && state.started_at) {
          pos = (Date.now() - new Date(state.started_at).getTime()) + state.paused_pos_ms;
        }
      } else if (state.started_at) pos = (Date.now() - new Date(state.started_at).getTime()) + state.paused_pos_ms;
      else pos = 0;
      setPosMs(Math.min(pos, dur));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, scrubbing]);

  const onSearchAndQueue = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || !user) return;
    if (locked) { toast.error("الموسيقى مقفلة في هذه الغرفة"); return; }
    setSearching(true);
    await supabase.rpc("room_bot_say", {
      _room: roomId, _text: `🔎 جاري البحث عن: «${q}»`,
      _kind: "music_search", _meta: {} as never,
    });
    // In the Capacitor APK the SPA runs at https://localhost, so relative
    // serverFn URLs hit the device itself and fail. Detect native and call
    // the published HTTP endpoint absolutely instead.
    const isNative =
      typeof window !== "undefined" &&
      (((window as any).Capacitor?.isNativePlatform?.() ?? false) ||
        /^https?:\/\/localhost/i.test(window.location.origin));
    let track: TrackResult | null = null;
    let error: string | null = null;
    try {
      if (isNative) {
        const r = await fetch(
          `https://giant-chat.lovable.app/api/public/search-track?q=${encodeURIComponent(q)}`,
        );
        const j = (await r.json()) as { track: TrackResult | null; error: string | null };
        track = j.track;
        error = j.error;
      } else {
        const r = await searchTrack({ data: { q } });
        track = r.track;
        error = r.error;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "network";
    }
    if (!track) {
      toast.error(error === "no_results" ? "لم أجد نتائج" : "خطأ بالبحث");
      setSearching(false);
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    const enriched = { ...track, requester_name: prof?.username, requester_id: user.id };
    await supabase.rpc("music_play", { _room: roomId, _track: enriched as never });
    setQuery("");
    setSearching(false);
  };

  const seekTo = async (newPosMs: number) => {
    if (!state?.current) return;
    const clamped = Math.max(0, Math.min(state.current.duration_ms - 250, newPosMs));
    setPosMs(clamped);
    try { playerRef.current?.seekTo?.(clamped / 1000, true); } catch { /* ignore */ }
    const { error } = await (supabase.rpc as any)("music_seek", { _room: roomId, _pos_ms: Math.round(clamped) });
    if (error) toast.error(error.message);
  };

  const togglePlay = async () => {
    if (!state?.current) return;
    const wasPaused = state.paused;
    setNeedsGesture(false);
    const p = playerRef.current;
    if (p) {
      try {
        if (wasPaused) p.playVideo?.();
        else p.pauseVideo?.();
      } catch (err) { console.error(err); }
    }
    const { error } = await supabase.rpc(wasPaused ? "music_resume" : "music_pause", { _room: roomId });
    if (error) toast.error(error.message);
  };

  const publish = async (track: NonNullable<RoomMusic["current"]>) => {
    setPublishing(true);
    try {
      const { error } = await supabase.rpc("music_broadcast_publish", { _track: track as never, _source_room: roomId } as never);
      if (error) throw error;
      toast.success("تم نشر الأغنية في كل الغرف");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setPublishing(false); }
  };

  const dur = state?.current?.duration_ms ?? 0;
  const displayPos = scrubbing ?? posMs;
  const pct = dur > 0 ? Math.min(100, (displayPos / dur) * 100) : 0;

  return (
    <div className="border-b border-border bg-gradient-to-b from-primary/10 to-card">
      {/* Hidden YouTube IFrame — audio-only experience */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        <div ref={playerHostRef} />
      </div>

      <form onSubmit={onSearchAndQueue} className="flex items-center gap-2 px-3 py-2">
        <Music2 className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن أغنية على YouTube…"
          className="h-9 flex-1 rounded-full border border-input bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          بحث
        </button>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
          aria-label="طي"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </form>

      {open && state?.current && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2">
            <div className="relative">
              <img src={state.current.artwork} alt="" className="h-14 w-14 rounded-lg object-cover" />
              {(buffering || !playerReady) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold">{state.current.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {state.current.artist}
                {state.current.requester_name ? ` · طلبها ${state.current.requester_name}` : ""}
              </div>
              <div className="mt-0.5 text-[10px] text-primary font-semibold">
                {state.paused ? "⏸ متوقفة" : "▶️ قيد التشغيل عبر YouTube"}
              </div>
            </div>
          </div>

          {needsGesture && !state.paused && (
            <button
              onClick={togglePlay}
              className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-[12px] font-bold text-amber-600"
            >
              👆 اضغط هنا لبدء تشغيل الصوت (المتصفح يحجب التشغيل التلقائي)
            </button>
          )}

          <div className="flex items-center gap-2 px-1">
            <span className="w-10 text-[10px] tabular-nums text-muted-foreground">{fmt(displayPos)}</span>
            <input
              type="range"
              min={0}
              max={dur || 1}
              step={500}
              value={displayPos}
              onChange={(e) => setScrubbing(Number(e.target.value))}
              onMouseUp={() => { const v = scrubbing; setScrubbing(null); if (v !== null) seekTo(v); }}
              onTouchEnd={() => { const v = scrubbing; setScrubbing(null); if (v !== null) seekTo(v); }}
              className="flex-1 accent-primary"
              style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`, borderRadius: 9999, height: 4 }}
            />
            <span className="w-10 text-[10px] tabular-nums text-muted-foreground">{fmt(dur)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => seekTo(displayPos - 10000)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="ترجيع 10 ثوان"><Rewind className="h-4 w-4" /></button>
            <button
              onClick={togglePlay}
              disabled={!playerReady}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50"
              aria-label={state.paused ? "تشغيل" : "إيقاف"}>
              {!playerReady ? <Loader2 className="h-4 w-4 animate-spin" /> : state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => seekTo(displayPos + 10000)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="تقديم 10 ثوان"><FastForward className="h-4 w-4" /></button>
            <button onClick={async () => {
                const { error } = await supabase.rpc("music_skip", { _room: roomId });
                if (error) toast.error(error.message);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border" aria-label="تخطي">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={async () => {
                const { error } = await supabase.rpc("music_stop", { _room: roomId });
                if (error) toast.error(error.message);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 text-destructive"
              aria-label="إيقاف">
              <X className="h-4 w-4" />
            </button>
            <button onClick={() => setMuted(m => !m)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="كتم">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setLocked(l => !l)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${locked ? "border-destructive text-destructive" : "border-border"}`}
              aria-label="قفل">
              {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="ms-auto flex h-9 items-center gap-1 rounded-full bg-secondary px-3 text-[11px] font-bold"
              aria-label="مشاركة مع مستخدم">
              <UserPlus className="h-3.5 w-3.5" /> مشاركة
            </button>
            <button
              onClick={() => publish(state.current!)}
              disabled={publishing}
              className="flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary/70 px-3 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
              aria-label="نشر">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              نشر
            </button>
          </div>

          <div className="flex items-center gap-2 px-1">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="range" min={0} max={100} defaultValue={state.volume}
              onChange={(e) => supabase.rpc("music_set_volume", { _room: roomId, _vol: Number(e.target.value) })}
              className="flex-1 accent-primary" />
            {state.queue?.length > 0 && (
              <span className="text-[10px] text-muted-foreground">قائمة: {state.queue.length}</span>
            )}
          </div>
        </div>
      )}

      {shareOpen && state?.current && (
        <ShareTrackToUserModal track={state.current} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
export type { TrackResult };
