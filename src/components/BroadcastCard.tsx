import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Play, Pause } from "lucide-react";
import { toast } from "sonner";

const EMOJIS = ["❤️", "🔥", "👍", "😂", "🎶", "👏"];

type Track = {
  title: string; artist: string; artwork: string; preview_url: string;
};

export function BroadcastCard({
  broadcastId, requesterName, sourceRoomName, track,
}: { broadcastId: string; requesterName?: string; sourceRoomName?: string; track: Track }) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myEmoji, setMyEmoji] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("music_broadcast_reactions")
        .select("user_id, emoji")
        .eq("broadcast_id", broadcastId);
      if (cancelled || !data) return;
      const c: Record<string, number> = {};
      data.forEach(r => { c[r.emoji] = (c[r.emoji] ?? 0) + 1; });
      setCounts(c);
      setMyEmoji(data.find(r => r.user_id === user?.id)?.emoji ?? null);
    })();
    return () => { cancelled = true; };
  }, [broadcastId, user]);

  const togglePlay = () => {
    let a = audio;
    if (!a) {
      a = new Audio(track.preview_url);
      a.onended = () => setPlaying(false);
      setAudio(a);
    }
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const react = async (emoji: string) => {
    if (!user) return;
    const { error } = await supabase.rpc("music_broadcast_react", { _bid: broadcastId, _emoji: emoji });
    if (error) { toast.error(error.message); return; }
    setCounts(c => {
      const next = { ...c };
      if (myEmoji) next[myEmoji] = Math.max(0, (next[myEmoji] ?? 1) - 1);
      next[emoji] = (next[emoji] ?? 0) + 1;
      return next;
    });
    setMyEmoji(emoji);
  };

  return (
    <div className="mx-auto my-2 w-full max-w-md rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary p-3 shadow">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">📣 أغنية منشورة</div>
      <div className="flex items-center gap-3">
        <img src={track.artwork} alt="" className="h-14 w-14 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">{track.title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{track.artist}</div>
          {requesterName && (
            <div className="truncate text-[10px] text-primary">
              شارك بواسطة {requesterName}{sourceRoomName ? ` من «${sourceRoomName}»` : ""}
            </div>
          )}
        </div>
        <button onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {EMOJIS.map(e => {
          const n = counts[e] ?? 0;
          const mine = myEmoji === e;
          return (
            <button key={e} type="button" onClick={() => react(e)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${mine ? "border-primary bg-primary/15" : "border-border bg-card"}`}>
              <span>{e}</span>
              {n > 0 && <span className="font-bold">{n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
