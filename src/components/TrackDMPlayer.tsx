import { useRef, useState } from "react";
import { useEffect } from "react";
import { Play, Pause, Music2 } from "lucide-react";

type Track = { title: string; artist: string; artwork: string; preview_url: string; duration_ms?: number };

/** Parses a DM content that starts with "🎵TRACK::<json>::<sender_name>" */
export function tryParseTrackDM(content: string): { track: Track; senderName: string } | null {
  if (!content.startsWith("🎵TRACK::")) return null;
  const body = content.slice("🎵TRACK::".length);
  const sep = body.lastIndexOf("::");
  if (sep < 0) return null;
  const jsonPart = body.slice(0, sep);
  const senderName = body.slice(sep + 2);
  try {
    const track = JSON.parse(jsonPart);
    if (!track?.preview_url || !track?.title) return null;
    return { track, senderName };
  } catch { return null; }
}

export function TrackDMPlayer({ track, senderName, mine }: { track: Track; senderName: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) a.pause(); else a.play().catch(() => {});
  };

  return (
    <div className={`w-64 rounded-2xl border ${mine ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-primary/30 bg-card"} p-2`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Music2 className="h-3 w-3" /> أغنية مشاركة
      </div>
      <div className="flex items-center gap-2">
        <img src={track.artwork} className="h-14 w-14 rounded-xl object-cover" alt="" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">{track.title}</div>
          <div className="truncate text-[11px] opacity-80">{track.artist}</div>
          <div className="truncate text-[10px] opacity-70">من {senderName}</div>
        </div>
        <button onClick={toggle} type="button"
          className={`flex h-10 w-10 items-center justify-center rounded-full ${mine ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"}`}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
      <audio ref={audioRef} src={track.preview_url} preload="none" className="hidden" />
    </div>
  );
}
