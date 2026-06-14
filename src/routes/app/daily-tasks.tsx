import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Gift, Sparkles, Trophy, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/daily-tasks")({
  component: DailyTasksPage,
});

type Task = { kind: string; label: string; target: number; reward: number; progress: number; claimed: boolean };
type Level = { level: number; min_points: number; name: string };

function DailyTasksPage() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    if (!session?.user?.id) return;
    const [tRes, lRes, pRes] = await Promise.all([
      supabase.rpc("get_my_daily_tasks"),
      supabase.from("level_thresholds").select("*").order("level"),
      supabase.from("profiles").select("points").eq("id", session.user.id).maybeSingle(),
    ]);
    setTasks((tRes.data as Task[]) ?? []);
    setLevels((lRes.data as Level[]) ?? []);
    setPoints((pRes.data?.points as number) ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [session?.user?.id]);

  const claim = async (kind: string) => {
    setClaiming(kind);
    const { data, error } = await supabase.rpc("claim_daily_reward", { _kind: kind });
    setClaiming(null);
    if (error) {
      const m = error.message || "";
      if (m.includes("already_claimed")) toast.error("تم استلام هذه المكافأة سابقًا");
      else if (m.includes("task_not_completed")) toast.error("المهمة لم تكتمل بعد");
      else toast.error("تعذّر استلام المكافأة");
      return;
    }
    const r = data as any;
    let msg = `+${r.reward_points} نقطة`;
    if (r.gift_name) msg += ` و ${r.gift_name} (+${r.gift_pts ?? r.gift_points} نقطة)`;
    if (r.level_up) msg += ` · ترقّيت للمستوى ${r.new_level} (${r.level_name})`;
    toast.success(msg, { duration: 6000 });
    await load();
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  }

  const currentLevel = [...levels].reverse().find((l) => l.min_points <= points) ?? levels[0];
  const nextLevel = levels.find((l) => l.min_points > points);
  const progressToNext = nextLevel && currentLevel
    ? Math.min(100, Math.round(((points - currentLevel.min_points) / (nextLevel.min_points - currentLevel.min_points)) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24" dir="rtl">
      {/* Level card */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/40">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">المستوى الحالي</div>
            <div className="text-xl font-extrabold">{currentLevel?.level ?? 1} · {currentLevel?.name ?? "مبتدئ"}</div>
            <div className="text-xs opacity-90">{points} نقطة</div>
          </div>
        </div>
        {nextLevel && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] opacity-90">
              <span>للمستوى {nextLevel.level} · {nextLevel.name}</span>
              <span>{points}/{nextLevel.min_points}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white" style={{ width: `${progressToNext}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/50 bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-xs leading-relaxed">
          أكمل المهام يوميًا لكسب النقاط ورفع مستواك. كل مهمة قد تخفي
          <span className="font-bold"> هدية عشوائية قيّمة</span>!
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2.5">
        {tasks.map((t) => {
          const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
          const done = t.progress >= t.target;
          return (
            <div key={t.kind} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  t.claimed ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : done ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-secondary text-muted-foreground"}`}>
                  {t.claimed ? <CheckCircle2 className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-bold">{t.label}</div>
                    <div className="text-xs font-bold text-amber-600">+{t.reward}</div>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full transition-all ${done ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-amber-400 to-orange-500"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t.progress}/{t.target}</span>
                    <button
                      onClick={() => claim(t.kind)}
                      disabled={!done || t.claimed || claiming === t.kind}
                      className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                        t.claimed ? "bg-emerald-500/10 text-emerald-600"
                        : done ? "bg-amber-500 text-white shadow active:scale-95"
                        : "bg-secondary text-muted-foreground"}`}
                    >
                      {t.claimed ? "تم الاستلام" : claiming === t.kind ? "..." : done ? "استلم المكافأة" : "قيد التقدم"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        تتجدد المهام تلقائيًا كل يوم عند منتصف الليل بتوقيت UTC.
      </p>
    </div>
  );
}
