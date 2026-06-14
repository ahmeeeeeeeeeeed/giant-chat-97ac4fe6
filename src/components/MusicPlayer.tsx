import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Music2, Pause, Play, SkipForward, X, Volume2, VolumeX, Search,
  Loader2, Share2, ChevronDown, ChevronUp, Lock, Unlock, UserPlus,
  Rewind, FastForward,
} from "lucide-react";
import { searchTrack, type TrackResult } from "@/lib/music.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ShareTrackToUserModal } from "@/components/ShareTrackToUserModal";

export type RoomMusic = {
  current: ({
    title: string; artist: string; artwork: string; preview_url: string;
    duration_ms: number; requester_name?: string; requester_id?: string;
  }) | null;
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
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Cleanup on unmount
  useEffect(() => () => {
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch { /* ignore */ } a.removeAttribute("src"); a.load(); }
  }, []);

  // Sync audio element with shared state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!state?.current?.preview_url) {
      try { a.pause(); } catch { /* ignore */ }
      a.removeAttribute("src");
      setLoadingAudio(false);
      setPosMs(0);
      return;
    }
    const url = state.current.preview_url;
    if (a.src !== url) {
      setLoadingAudio(true);
      a.src = url;
      a.preload = "auto";
      a.load();
    }
    a.volume = muted ? 0 : Math.max(0, Math.min(1, (state.volume ?? 70) / 100));
    a.muted = muted;
    const targetSec = state.paused
      ? state.paused_pos_ms / 1000
      : Math.max(0, ((Date.now() - new Date(state.started_at ?? Date.now()).getTime()) + state.paused_pos_ms) / 1000);
    if (isFinite(targetSec) && Math.abs(a.currentTime - targetSec) > 0.6) {
      try { a.currentTime = targetSec; } catch { /* ignore */ }
    }
    if (state.paused) {
      try { a.pause(); } catch { /* ignore */ }
    } else {
      a.play().catch(() => {/* needs user gesture */});
    }
  }, [state, muted]);

  // Tick the progress bar
  useEffect(() => {
    if (!state?.current) { setPosMs(0); return; }
    const dur = state.current.duration_ms;
    let raf = 0;
    const tick = () => {
      if (scrubbing !== null) { raf = requestAnimationFrame(tick); return; }
      const a = audioRef.current;
      let p: number;
      if (state.paused) p = state.paused_pos_ms;
      else if (a && a.currentTime > 0) p = a.currentTime * 1000;
      else if (state.started_at) p = (Date.now() - new Date(state.started_at).getTime()) + state.paused_pos_ms;
      else p = 0;
      setPosMs(Math.min(p, dur));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, scrubbing]);

  const onAudioReady = () => setLoadingAudio(false);
  const onAudioError = () => { setLoadingAudio(false); toast.error("تعذّر تحميل الصوت"); };
  const onEnded = async () => {
    setPosMs(state?.current?.duration_ms ?? 0);
    await supabase.rpc("music_advance_if_ended", { _room: roomId });
  };

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
    const { track, error } = await searchTrack({ data: { q } });
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
    const a = audioRef.current;
    if (a) { try { a.currentTime = clamped / 1000; } catch { /* ignore */ } }
    const { error } = await (supabase.rpc as any)("music_seek", { _room: roomId, _pos_ms: Math.round(clamped) });
    if (error) toast.error(error.message);
  };

  const togglePlay = async () => {
    if (!state?.current) return;
    const a = audioRef.current;
    const wasPaused = state.paused;
    // Preserve user gesture for autoplay policy
    if (a && state.current.preview_url) {
      if (a.src !== state.current.preview_url) { a.src = state.current.preview_url; a.load(); }
      if (wasPaused) {
        try { await a.play(); } catch (err) {
          toast.error("اضغط مرة أخرى لتشغيل الصوت");
          console.error("audio.play failed", err);
        }
      } else {
        try { a.pause(); } catch { /* ignore */ }
      }
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
      <audio
        ref={audioRef}
        onEnded={onEnded}
        onCanPlayThrough={onAudioReady}
        onCanPlay={onAudioReady}
        onLoadedData={onAudioReady}
        onError={onAudioError}
        onWaiting={() => setLoadingAudio(true)}
        onPlaying={() => setLoadingAudio(false)}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
      />

      <form onSubmit={onSearchAndQueue} className="flex items-center gap-2 px-3 py-2">
        <Music2 className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن أغنية…"
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
              {loadingAudio && (
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
                {state.paused ? "⏸ متوقفة" : "▶️ قيد التشغيل"}
                {dur <= 30500 ? " · معاينة 30 ثانية" : ""}
              </div>
            </div>
          </div>

          {/* Progress / scrubber */}
          <div className="flex items-center gap-2 px-1">
            <span className="w-10 text-[10px] tabular-nums text-muted-foreground">{fmt(displayPos)}</span>
            <input
              type="range"
              min={0}
              max={dur || 1}
              step={250}
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
            <button onClick={() => seekTo(displayPos - 5000)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="ترجيع 5 ثوان"><Rewind className="h-4 w-4" /></button>
            <button
              onClick={togglePlay}
              disabled={loadingAudio}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50"
              aria-label={state.paused ? "تشغيل" : "إيقاف"}>
              {loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => seekTo(displayPos + 5000)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="تقديم 5 ثوان"><FastForward className="h-4 w-4" /></button>
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
