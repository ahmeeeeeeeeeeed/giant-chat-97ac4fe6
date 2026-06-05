import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music2, Pause, Play, SkipForward, X, Volume2 } from "lucide-react";

export type RoomMusic = {
  current: {
    title: string; artist: string; artwork: string; preview_url: string;
    duration_ms: number; requester_name?: string;
  } | null;
  queue: Array<{ title: string; artist: string }>;
  started_at: string | null;
  paused: boolean;
  paused_pos_ms: number;
  volume: number;
};

export function MusicPlayer({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomMusic | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "room_music", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Sync audio element
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!state?.current?.preview_url) { a.pause(); a.removeAttribute("src"); return; }
    if (a.src !== state.current.preview_url) {
      a.src = state.current.preview_url;
      a.load();
    }
    a.volume = (state.volume ?? 70) / 100;
    if (state.paused) {
      a.currentTime = state.paused_pos_ms / 1000;
      a.pause();
    } else if (state.started_at) {
      const elapsed = (Date.now() - new Date(state.started_at).getTime() + state.paused_pos_ms) / 1000;
      if (Math.abs(a.currentTime - elapsed) > 0.6) a.currentTime = Math.max(0, elapsed);
      a.play().catch(() => {/* autoplay blocked */});
    }
  }, [state]);

  const onEnded = async () => {
    await supabase.rpc("music_advance_if_ended", { _room: roomId });
  };

  if (!state?.current) return <audio ref={audioRef} onEnded={onEnded} />;
  const t = state.current;

  return (
    <>
      <audio ref={audioRef} onEnded={onEnded} />
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-3 py-2 text-start w-full">
        <img src={t.artwork} alt="" className="h-10 w-10 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Music2 className="h-3 w-3 text-primary" />
            <span className="truncate text-[13px] font-bold">{t.title}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t.artist}{t.requester_name ? ` · طلبها ${t.requester_name}` : ""}
          </div>
        </div>
        {state.paused
          ? <Play className="h-4 w-4 text-primary" />
          : <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />}
      </button>
      {open && (
        <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-2">
          <button onClick={() => supabase.rpc(state.paused ? "music_resume" : "music_pause", { _room: roomId })}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={() => supabase.rpc("music_skip", { _room: roomId })}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
            <SkipForward className="h-4 w-4" />
          </button>
          <button onClick={() => supabase.rpc("music_stop", { _room: roomId })}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 text-destructive">
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input type="range" min={0} max={100} defaultValue={state.volume}
              onChange={(e) => supabase.rpc("music_set_volume", { _room: roomId, _vol: Number(e.target.value) })}
              className="flex-1 accent-primary" />
          </div>
          {state.queue?.length > 0 && (
            <span className="text-[10px] text-muted-foreground">قائمة: {state.queue.length}</span>
          )}
        </div>
      )}
    </>
  );
}
