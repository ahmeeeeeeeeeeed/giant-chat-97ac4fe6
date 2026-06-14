import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Coins, Crown, Sparkles, Medal, Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/app/achievements")({
  component: AchievementsPage,
});

type WinnerRow = { user_id: string; username: string; avatar_url: string | null; wins: number };


type Row = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  breakdown: Record<string, number>;
};

type Board = { posters: Row[]; spenders: Row[]; overall: Row[]; week_start: string; week_end: string };

const TABS = [
  { key: "overall", label: "الأكثر تفاعلًا", icon: Crown, gradient: "from-amber-500 via-orange-500 to-rose-500", desc: "غرف • منشورات • تفاعل • إنفاق" },
  { key: "posters", label: "نجوم المنشورات", icon: Flame, gradient: "from-fuchsia-500 via-pink-500 to-rose-500", desc: "نشر • تعليقات • إعجابات على منشوراتك" },
  { key: "spenders", label: "أكبر المشترين", icon: Coins, gradient: "from-emerald-500 via-teal-500 to-cyan-500", desc: "النقاط المنفقة في المتجر هذا الأسبوع" },
  { key: "winners", label: "أبطال الألعاب", icon: Gamepad2, gradient: "from-violet-500 via-purple-500 to-indigo-600", desc: "الأكثر فوزاً في ألعاب التطبيق" },
] as const;

function AchievementsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overall");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data, error }, { data: w }] = await Promise.all([
        supabase.rpc("get_weekly_leaderboards", { _limit: 20 }),
        supabase.rpc("get_top_game_winners", { _limit: 20 }),
      ]);
      if (mounted) {
        if (!error && data) setBoard(data as Board);
        if (w) setWinners(w as WinnerRow[]);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const rows: Row[] = tab === "winners"
    ? winners.map(w => ({ user_id: w.user_id, username: w.username, avatar_url: w.avatar_url, score: w.wins, breakdown: { wins: w.wins } }))
    : ((board?.[tab] ?? []) as Row[]);
  const weekEnd = board?.week_end ? new Date(board.week_end) : null;
  const daysLeft = weekEnd ? Math.max(0, Math.ceil((weekEnd.getTime() - Date.now()) / 86400000)) : null;

  return (
    <main className="flex flex-1 flex-col bg-gradient-to-b from-background to-secondary/30 pb-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 pb-6 pt-5 text-white shadow-xl">
        <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -start-10 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/40 backdrop-blur">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">الإنجازات الأسبوعية</h1>
            <p className="text-[12px] text-white/85">{daysLeft !== null ? `يتبقى ${daysLeft} يوم • يُعاد التصفير الإثنين` : "إعادة التصفير كل أسبوع"}</p>
          </div>
          <div className="ms-auto">
            <Sparkles className="h-5 w-5 opacity-80" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mt-3 px-3">
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-md">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition ${
                  active ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg` : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">
          {TABS.find((x) => x.key === tab)?.desc}
        </p>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 px-3 pt-3">
        {loading && (
          <div className="flex justify-center py-10">
            <span className="block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
            لا توجد بيانات هذا الأسبوع بعد — كن أول من يتصدر!
          </div>
        )}
        {!loading && rows.slice(0, 3).map((r, i) => <PodiumCard key={r.user_id} row={r} rank={i + 1} />)}
        {!loading && rows.length > 3 && (
          <div className="mt-1 overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {rows.slice(3).map((r, i) => <RankRow key={r.user_id} row={r} rank={i + 4} tab={tab} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function PodiumCard({ row, rank }: { row: Row; rank: number }) {
  const styles = rank === 1
    ? { bg: "from-amber-400 via-yellow-500 to-amber-600", ring: "ring-amber-300", label: "🥇 المركز الأول" }
    : rank === 2
    ? { bg: "from-slate-300 via-slate-400 to-slate-500", ring: "ring-slate-200", label: "🥈 المركز الثاني" }
    : { bg: "from-orange-400 via-amber-700 to-amber-800", ring: "ring-amber-400", label: "🥉 المركز الثالث" };

  return (
    <Link to="/app/profile/$id" params={{ id: row.user_id }}
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br ${styles.bg} p-3 text-white shadow-lg`}>
      <div className="absolute -end-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
      <div className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white/30 ring-2 ${styles.ring}`}>
        {row.avatar_url ? (
          <img src={row.avatar_url} alt={row.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold">{row.username?.[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[11px] font-bold opacity-90">{styles.label}</div>
        <div className="truncate text-base font-extrabold">{row.username}</div>
      </div>
      <div className="relative flex flex-col items-center rounded-xl bg-black/20 px-3 py-1.5 backdrop-blur">
        <div className="text-lg font-extrabold leading-none">{row.score.toLocaleString()}</div>
        <div className="text-[10px] opacity-80">نقطة</div>
      </div>
    </Link>
  );
}

function RankRow({ row, rank, tab }: { row: Row; rank: number; tab: string }) {
  return (
    <Link to="/app/profile/$id" params={{ id: row.user_id }} className="flex items-center gap-3 p-3 transition hover:bg-secondary/60">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
        {rank}
      </div>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary">
        {row.avatar_url ? (
          <img src={row.avatar_url} alt={row.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold">{row.username?.[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{row.username}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {tab === "spenders" ? `${row.breakdown?.items ?? 0} عنصر` : tab === "posters" ? `${row.breakdown?.posts ?? 0} منشور` : `${row.breakdown?.room_messages ?? 0} رسالة`}
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm font-extrabold text-primary">
        <Medal className="h-3.5 w-3.5" />
        {row.score.toLocaleString()}
      </div>
    </Link>
  );
}
