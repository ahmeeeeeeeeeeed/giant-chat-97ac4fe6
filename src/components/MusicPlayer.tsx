import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Music2, Pause, Play, SkipForward, X, Volume2, VolumeX, Search,
  Loader2, Share2, ChevronDown, ChevronUp, Lock, Unlock,
} from "lucide-react";
import { searchTrack, type TrackResult } from "@/lib/music.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

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

export function MusicPlayer({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<RoomMusic | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("room_music")
      .select("current, queue, started_at, paused, paused_pos_ms, volume")
      .eq("room_id", roomId).maybeSingle();
    setState((data as RoomMusic | null) ?? null);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Sync audio element with shared state (NEVER autoplays — only when paused=false)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!state?.current?.preview_url) { a.pause(); a.removeAttribute("src"); return; }
    if (a.src !== state.current.preview_url) {
      a.src = state.current.preview_url;
      a.load();
    }
    a.volume = muted ? 0 : (state.volume ?? 70) / 100;
    if (state.paused) {
      a.currentTime = state.paused_pos_ms / 1000;
      a.pause();
    } else if (state.started_at) {
      const elapsed = (Date.now() - new Date(state.started_at).getTime() + state.paused_pos_ms) / 1000;
      if (Math.abs(a.currentTime - elapsed) > 0.6) a.currentTime = Math.max(0, elapsed);
      a.play().catch(() => {/* user gesture required */});
    }
  }, [state, muted]);

  const onEnded = async () => {
    await supabase.rpc("music_advance_if_ended", { _room: roomId });
  };

  const onSearchAndQueue = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || !user) return;
    if (locked) { toast.error("الموسيقى مقفلة في هذه الغرفة"); return; }
    setSearching(true);
    // post a "searching" system message visible to all
    await supabase.rpc("room_bot_say", {
      _room: roomId,
      _text: `🔎 جاري البحث عن: «${q}»`,
      _kind: "music_search",
      _meta: {} as never,
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

  const seek = (deltaSec: number) => {
    const a = audioRef.current;
    if (!a || !state?.current) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 30, a.currentTime + deltaSec));
  };

  const publish = async (track: NonNullable<RoomMusic["current"]>) => {
    setPublishing(true);
    try {
      const { error } = await supabase.rpc("music_broadcast_publish", { _track: track as never });
      if (error) throw error;
      toast.success("تم نشر الأغنية في كل الغرف");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setPublishing(false); }
  };

  return (
    <div className="border-b border-border bg-gradient-to-b from-primary/10 to-card">
      <audio ref={audioRef} onEnded={onEnded} />

      {/* Search bar — always visible */}
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

      {/* Current track + controls */}
      {open && state?.current && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2">
            <img src={state.current.artwork} alt="" className="h-14 w-14 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold">{state.current.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {state.current.artist}
                {state.current.requester_name ? ` · طلبها ${state.current.requester_name}` : ""}
              </div>
              <div className="mt-0.5 text-[10px] text-primary font-semibold">
                {state.paused ? "⏸ متوقفة — اضغط تشغيل" : "▶️ قيد التشغيل"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => seek(-5)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-bold"
              aria-label="ترجيع">−5</button>
            <button
              onClick={() => supabase.rpc(state.paused ? "music_resume" : "music_pause", { _room: roomId })}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              aria-label={state.paused ? "تشغيل" : "إيقاف"}>
              {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => seek(5)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-bold"
              aria-label="تقديم">+5</button>
            <button onClick={() => supabase.rpc("music_skip", { _room: roomId })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border" aria-label="تخطي">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={() => supabase.rpc("music_stop", { _room: roomId })}
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
              onClick={() => publish(state.current!)}
              disabled={publishing}
              className="ms-auto flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary/70 px-3 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
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
    </div>
  );
}
