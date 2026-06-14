import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Flame, Coins, Trophy } from "lucide-react";

type Stats = {
  posters: { rank: number | null; score: number };
  spenders: { rank: number | null; score: number };
  overall: { rank: number | null; score: number };
};

function rankBadge(rank: number | null) {
  if (rank === 1) return { label: "#1", cls: "bg-gradient-to-br from-amber-400 to-yellow-600 text-white" };
  if (rank === 2) return { label: "#2", cls: "bg-gradient-to-br from-slate-300 to-slate-500 text-white" };
  if (rank === 3) return { label: "#3", cls: "bg-gradient-to-br from-orange-400 to-amber-700 text-white" };
  if (rank && rank <= 10) return { label: `#${rank}`, cls: "bg-primary/15 text-primary" };
  if (rank) return { label: `#${rank}`, cls: "bg-secondary text-muted-foreground" };
  return { label: "—", cls: "bg-secondary text-muted-foreground" };
}

export function WeeklyAchievementsBadge({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_weekly_user_stats", { _user: userId });
      if (mounted && !error && data) setStats(data as Stats);
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (!stats) return null;
  const items = [
    { key: "overall", icon: Crown, label: "تفاعل عام", ...stats.overall },
    { key: "posters", icon: Flame, label: "النشر", ...stats.posters },
    { key: "spenders", icon: Coins, label: "الإنفاق", ...stats.spenders },
  ];

  return (
    <Link to="/app/achievements"
      className="mt-3 block rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-secondary p-3 transition active:scale-[0.99]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-bold">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          الإنجازات الأسبوعية
        </div>
        <span className="text-[10px] text-muted-foreground">يُعاد التصفير الإثنين</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const b = rankBadge(it.rank);
          const Icon = it.icon;
          return (
            <div key={it.key} className="flex flex-col items-center gap-1 rounded-xl bg-background/60 p-2">
              <Icon className="h-4 w-4 text-amber-500" />
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${b.cls}`}>{b.label}</span>
              <span className="text-[10px] text-muted-foreground">{it.label}</span>
              <span className="text-[10px] font-semibold">{it.score?.toLocaleString?.() ?? 0}</span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
