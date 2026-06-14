import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Trophy, Coins, Gift, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/games")({
  component: GamesPage,
});

function GamesPage() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [wins, setWins] = useState<number>(0);
  const [lastDaily, setLastDaily] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("points, game_wins")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setPoints((data as { points: number }).points ?? 0);
      setWins((data as { game_wins: number }).game_wins ?? 0);
    }
    setLastDaily(localStorage.getItem(`giant_daily_${user.id}`));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const recordWin = async (game: string, pts = 5) => {
    const { error } = await supabase.rpc("record_game_win", { _game: game, _points: pts });
    if (error) { toast.error(error.message); return; }
    toast.success(`🏆 فزت! +${pts} نقطة`);
    refresh();
  };

  // Daily reward
  const todayKey = new Date().toISOString().slice(0, 10);
  const claimedToday = lastDaily === todayKey;
  const claimDaily = async () => {
    if (claimedToday || !user) return;
    const pts = 10 + Math.floor(Math.random() * 21); // 10-30
    const { error } = await supabase.rpc("record_game_win", { _game: "daily", _points: pts });
    if (error) { toast.error(error.message); return; }
    localStorage.setItem(`giant_daily_${user.id}`, todayKey);
    setLastDaily(todayKey);
    toast.success(`🎁 جائزتك اليومية: +${pts} نقطة`);
    refresh();
  };

  return (
    <main className="flex flex-1 flex-col pb-6 bg-gradient-to-b from-background to-secondary/30">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 px-5 py-5 text-white shadow-xl">
        <div className="absolute -end-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -start-12 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/40 backdrop-blur text-2xl">🎮</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold">ألعاب Giant Chat</h1>
            <p className="text-[12px] text-white/85">تنافس واربح النقاط — كل فوز يُحسب في الإنجازات</p>
          </div>
          <Sparkles className="h-5 w-5 opacity-80" />
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur px-3 py-2">
            <div className="text-[10px] opacity-80">نقاطك</div>
            <div className="flex items-center gap-1.5 text-lg font-extrabold">
              <Coins className="h-4 w-4 text-yellow-300" />{points}
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur px-3 py-2">
            <div className="text-[10px] opacity-80">عدد انتصاراتك</div>
            <div className="flex items-center gap-1.5 text-lg font-extrabold">
              <Trophy className="h-4 w-4 text-amber-300" />{wins}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-3 pt-4">
        {/* Daily reward */}
        <button onClick={claimDaily} disabled={claimedToday}
          className={`flex items-center gap-3 rounded-2xl p-3 text-white shadow-lg transition active:scale-[0.99] ${
            claimedToday ? "bg-gradient-to-br from-slate-400 to-slate-500 opacity-70" :
              "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
          }`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/25 text-2xl">🎁</div>
          <div className="flex-1 text-start">
            <div className="font-extrabold">الجائزة اليومية</div>
            <div className="text-[11px] opacity-90">{claimedToday ? "تم استلامها اليوم — عد غداً" : "اضغط لاستلام نقاطك اليومية"}</div>
          </div>
          <Gift className="h-5 w-5" />
        </button>

        <h2 className="mt-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">الألعاب</h2>

        <GuessNumber onWin={() => recordWin("guess_number", 5)} />
        <QuizGame onWin={() => recordWin("quiz", 5)} />
        <ScrambleWord onWin={() => recordWin("scramble", 6)} />
        <FastestAnswer onWin={() => recordWin("fastest", 4)} />
        <PatternGame onWin={() => recordWin("pattern", 6)} />
        <GuessCharacter onWin={() => recordWin("character", 7)} />
        <GuessCountry onWin={() => recordWin("country", 6)} />
        <LuckyBox onWin={(p) => recordWin("lucky_box", p)} />
      </div>
    </main>
  );
}

// ============ Card wrapper ============
function GameCard({ emoji, title, desc, gradient, children }: { emoji: string; title: string; desc: string; gradient: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className={`flex items-center gap-3 bg-gradient-to-r ${gradient} px-4 py-3 text-white`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl ring-1 ring-white/30 backdrop-blur">{emoji}</div>
        <div className="min-w-0">
          <div className="font-extrabold leading-tight">{title}</div>
          <div className="truncate text-[11px] text-white/85">{desc}</div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ============ 🎲 تخمين الرقم ============
function GuessNumber({ onWin }: { onWin: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; n: number } | null>(null);
  const play = (n: number) => {
    setPick(n);
    const sys = Math.floor(Math.random() * 6) + 1;
    const ok = sys === n;
    setResult({ ok, n: sys });
    if (ok) onWin();
  };
  return (
    <GameCard emoji="🎲" title="تخمين الرقم" desc="اختر رقماً من 1 إلى 6" gradient="from-emerald-500 to-teal-600">
      <div className="grid grid-cols-6 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <button key={n} onClick={() => play(n)}
            className={`h-12 rounded-xl text-lg font-extrabold transition active:scale-95 ${
              pick === n ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            }`}>{n}</button>
        ))}
      </div>
      {result && (
        <div className={`mt-3 rounded-xl p-2.5 text-center text-sm font-bold ${result.ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
          {result.ok ? `🎉 فزت! الرقم كان ${result.n}` : `خسرت — الرقم كان ${result.n}`}
        </div>
      )}
      <button onClick={() => { setPick(null); setResult(null); }} className="mt-2 w-full text-xs text-muted-foreground">إعادة</button>
    </GameCard>
  );
}

// ============ ❓ سؤال وجواب ============
const QUIZ = [
  { q: "ما عاصمة اليابان؟", o: ["طوكيو", "بكين", "سيول", "بانكوك"], a: 0 },
  { q: "من اخترع المصباح الكهربائي؟", o: ["نيوتن", "أديسون", "أينشتاين", "تسلا"], a: 1 },
  { q: "كم عدد كواكب المجموعة الشمسية؟", o: ["7", "8", "9", "10"], a: 1 },
  { q: "ما أكبر محيط في العالم؟", o: ["الأطلسي", "الهندي", "الهادئ", "المتجمد"], a: 2 },
  { q: "في أي عام نزل الإنسان على القمر؟", o: ["1965", "1969", "1972", "1980"], a: 1 },
  { q: "أي لغة برمجة طورها Brendan Eich؟", o: ["Python", "Java", "JavaScript", "C++"], a: 2 },
  { q: "بطل كأس العالم 2022؟", o: ["البرازيل", "فرنسا", "الأرجنتين", "ألمانيا"], a: 2 },
  { q: "مخرج فيلم Inception؟", o: ["سبيلبرغ", "نولان", "تارانتينو", "كاميرون"], a: 1 },
];
function QuizGame({ onWin }: { onWin: () => void }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUIZ.length));
  const [picked, setPicked] = useState<number | null>(null);
  const item = QUIZ[i];
  const next = () => { setI(Math.floor(Math.random() * QUIZ.length)); setPicked(null); };
  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === item.a) onWin();
  };
  return (
    <GameCard emoji="❓" title="سؤال وجواب" desc="ثقافة عامة • تكنولوجيا • رياضة" gradient="from-sky-500 to-blue-600">
      <div className="mb-3 rounded-xl bg-secondary p-3 text-center text-sm font-bold">{item.q}</div>
      <div className="grid grid-cols-2 gap-2">
        {item.o.map((opt, idx) => {
          const isAns = idx === item.a;
          const shown = picked !== null;
          const cls = !shown ? "bg-secondary hover:bg-secondary/70"
            : isAns ? "bg-emerald-500 text-white"
            : idx === picked ? "bg-destructive text-white" : "bg-secondary opacity-60";
          return (
            <button key={idx} onClick={() => pick(idx)} className={`h-11 rounded-xl text-sm font-bold transition ${cls}`}>{opt}</button>
          );
        })}
      </div>
      {picked !== null && (
        <button onClick={next} className="mt-3 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">سؤال جديد</button>
      )}
    </GameCard>
  );
}

// ============ 🧩 فك الحروف ============
const WORDS = ["برمجة", "كرسي", "نهار", "جامعة", "كتاب", "مطر", "شمس", "نجوم", "قمر", "صديق", "محبة", "حلم", "وردة", "بحر", "جبل"];
function shuffle(s: string) {
  const a = s.split("");
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const out = a.join("");
  return out === s ? shuffle(s) : out;
}
function ScrambleWord({ onWin }: { onWin: () => void }) {
  const [w, setW] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [scr, setScr] = useState(() => shuffle(w));
  const [guess, setGuess] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const next = () => { const nw = WORDS[Math.floor(Math.random() * WORDS.length)]; setW(nw); setScr(shuffle(nw)); setGuess(""); setMsg(null); };
  const submit = () => {
    if (guess.trim() === w) { setMsg("ok"); onWin(); }
    else setMsg("no");
  };
  return (
    <GameCard emoji="🧩" title="فك الحروف" desc="أعد ترتيب الحروف لاكتشاف الكلمة" gradient="from-violet-500 to-purple-600">
      <div className="mb-3 rounded-xl bg-secondary p-3 text-center font-mono text-2xl font-extrabold tracking-[0.4em]">{scr}</div>
      <div className="flex gap-2">
        <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="اكتب الكلمة"
          className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-center font-bold outline-none focus:border-foreground" />
        <button onClick={submit} className="h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">تحقق</button>
      </div>
      {msg === "ok" && <div className="mt-3 rounded-xl bg-emerald-500/15 p-2 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">🎉 صحيح!</div>}
      {msg === "no" && <div className="mt-3 rounded-xl bg-destructive/15 p-2 text-center text-sm font-bold text-destructive">حاول مجدداً</div>}
      <button onClick={next} className="mt-2 w-full text-xs text-muted-foreground">كلمة أخرى</button>
    </GameCard>
  );
}

// ============ ⚡ أسرع إجابة ============
const FAST = [
  { q: "2 + 2 × 3 = ?", o: ["8", "10", "12"], a: 0 },
  { q: "أكبر عدد: 7، 12، 9", o: ["7", "12", "9"], a: 1 },
  { q: "نصف 50 + 10 = ?", o: ["25", "35", "30"], a: 1 },
  { q: "كم يوماً في فبراير (عادي)؟", o: ["28", "29", "30"], a: 0 },
  { q: "9 × 9 = ?", o: ["72", "81", "99"], a: 1 },
];
function FastestAnswer({ onWin }: { onWin: () => void }) {
  const [item, setItem] = useState(() => FAST[Math.floor(Math.random() * FAST.length)]);
  const [start, setStart] = useState<number>(() => Date.now());
  const [picked, setPicked] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const next = () => { setItem(FAST[Math.floor(Math.random() * FAST.length)]); setStart(Date.now()); setPicked(null); setMs(null); };
  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    setMs(Date.now() - start);
    if (idx === item.a) onWin();
  };
  return (
    <GameCard emoji="⚡" title="أسرع إجابة" desc="أجب بسرعة لتفوز" gradient="from-yellow-500 to-orange-600">
      <div className="mb-3 rounded-xl bg-secondary p-3 text-center text-lg font-extrabold">{item.q}</div>
      <div className="grid grid-cols-3 gap-2">
        {item.o.map((o, idx) => {
          const shown = picked !== null;
          const cls = !shown ? "bg-secondary"
            : idx === item.a ? "bg-emerald-500 text-white"
            : idx === picked ? "bg-destructive text-white" : "bg-secondary opacity-60";
          return <button key={idx} onClick={() => pick(idx)} className={`h-11 rounded-xl font-bold ${cls}`}>{o}</button>;
        })}
      </div>
      {ms !== null && (
        <div className="mt-3 text-center text-xs text-muted-foreground">⏱ {ms} ms</div>
      )}
      {picked !== null && <button onClick={next} className="mt-2 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">تحدٍ جديد</button>}
    </GameCard>
  );
}

// ============ 🔢 أكمل النمط ============
const PATTERNS: { seq: number[]; opts: number[]; a: number }[] = [
  { seq: [2, 4, 6, 8], opts: [9, 10, 12], a: 1 },
  { seq: [1, 1, 2, 3, 5], opts: [7, 8, 9], a: 1 },
  { seq: [3, 6, 12, 24], opts: [36, 48, 60], a: 1 },
  { seq: [1, 4, 9, 16], opts: [20, 25, 30], a: 1 },
  { seq: [5, 10, 20, 40], opts: [60, 70, 80], a: 2 },
];
function PatternGame({ onWin }: { onWin: () => void }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * PATTERNS.length));
  const [picked, setPicked] = useState<number | null>(null);
  const item = PATTERNS[i];
  const next = () => { setI(Math.floor(Math.random() * PATTERNS.length)); setPicked(null); };
  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === item.a) onWin();
  };
  return (
    <GameCard emoji="🔢" title="أكمل النمط" desc="ما الرقم التالي في السلسلة؟" gradient="from-cyan-500 to-blue-600">
      <div className="mb-3 rounded-xl bg-secondary p-3 text-center font-mono text-xl font-extrabold tracking-widest">
        {item.seq.join(" · ")} · ?
      </div>
      <div className="grid grid-cols-3 gap-2">
        {item.opts.map((o, idx) => {
          const shown = picked !== null;
          const cls = !shown ? "bg-secondary"
            : idx === item.a ? "bg-emerald-500 text-white"
            : idx === picked ? "bg-destructive text-white" : "bg-secondary opacity-60";
          return <button key={idx} onClick={() => pick(idx)} className={`h-11 rounded-xl font-bold ${cls}`}>{o}</button>;
        })}
      </div>
      {picked !== null && <button onClick={next} className="mt-3 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">نمط جديد</button>}
    </GameCard>
  );
}

// ============ 🎭 خمن الشخصية ============
const CHARS = [
  { hints: ["عالم فيزياء", "نظرية النسبية", "ألماني الأصل"], name: "أينشتاين", opts: ["نيوتن", "أينشتاين", "تسلا"] },
  { hints: ["مؤسس Apple", "شخصية مبدعة", "iPhone"], name: "ستيف جوبز", opts: ["بيل غيتس", "ستيف جوبز", "إيلون ماسك"] },
  { hints: ["لاعب كرة قدم", "أرجنتيني", "كأس العالم 2022"], name: "ميسي", opts: ["رونالدو", "نيمار", "ميسي"] },
  { hints: ["ممثل أمريكي", "Titanic", "Inception"], name: "ليوناردو دي كابريو", opts: ["براد بيت", "ليوناردو دي كابريو", "توم كروز"] },
];
function GuessCharacter({ onWin }: { onWin: () => void }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * CHARS.length));
  const [picked, setPicked] = useState<string | null>(null);
  const item = CHARS[i];
  const next = () => { setI(Math.floor(Math.random() * CHARS.length)); setPicked(null); };
  const pick = (n: string) => {
    if (picked) return;
    setPicked(n);
    if (n === item.name) onWin();
  };
  return (
    <GameCard emoji="🎭" title="خمن الشخصية" desc="اكتشف من هي قبل الآخرين" gradient="from-pink-500 to-rose-600">
      <ul className="mb-3 space-y-1.5">
        {item.hints.map((h, idx) => (
          <li key={idx} className="rounded-xl bg-secondary px-3 py-2 text-sm">💡 {h}</li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-2">
        {item.opts.map(o => {
          const shown = picked !== null;
          const cls = !shown ? "bg-secondary"
            : o === item.name ? "bg-emerald-500 text-white"
            : o === picked ? "bg-destructive text-white" : "bg-secondary opacity-60";
          return <button key={o} onClick={() => pick(o)} className={`h-11 rounded-xl text-sm font-bold ${cls}`}>{o}</button>;
        })}
      </div>
      {picked !== null && <button onClick={next} className="mt-3 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">شخصية جديدة</button>}
    </GameCard>
  );
}

// ============ 🌍 خمن الدولة ============
const COUNTRIES = [
  { flag: "🇯🇵", name: "اليابان", opts: ["الصين", "اليابان", "كوريا"] },
  { flag: "🇫🇷", name: "فرنسا", opts: ["إيطاليا", "ألمانيا", "فرنسا"] },
  { flag: "🇧🇷", name: "البرازيل", opts: ["الأرجنتين", "البرازيل", "المكسيك"] },
  { flag: "🇪🇬", name: "مصر", opts: ["مصر", "السعودية", "المغرب"] },
  { flag: "🇸🇦", name: "السعودية", opts: ["الإمارات", "السعودية", "الكويت"] },
  { flag: "🇮🇹", name: "إيطاليا", opts: ["إسبانيا", "إيطاليا", "اليونان"] },
  { flag: "🇩🇪", name: "ألمانيا", opts: ["ألمانيا", "النمسا", "بولندا"] },
];
function GuessCountry({ onWin }: { onWin: () => void }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * COUNTRIES.length));
  const [picked, setPicked] = useState<string | null>(null);
  const item = COUNTRIES[i];
  const next = () => { setI(Math.floor(Math.random() * COUNTRIES.length)); setPicked(null); };
  const pick = (n: string) => {
    if (picked) return;
    setPicked(n);
    if (n === item.name) onWin();
  };
  return (
    <GameCard emoji="🌍" title="خمن الدولة" desc="احزر اسم الدولة من علمها" gradient="from-green-500 to-emerald-600">
      <div className="mb-3 flex justify-center text-7xl">{item.flag}</div>
      <div className="grid grid-cols-1 gap-2">
        {item.opts.map(o => {
          const shown = picked !== null;
          const cls = !shown ? "bg-secondary"
            : o === item.name ? "bg-emerald-500 text-white"
            : o === picked ? "bg-destructive text-white" : "bg-secondary opacity-60";
          return <button key={o} onClick={() => pick(o)} className={`h-11 rounded-xl text-sm font-bold ${cls}`}>{o}</button>;
        })}
      </div>
      {picked !== null && <button onClick={next} className="mt-3 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">دولة جديدة</button>}
    </GameCard>
  );
}

// ============ 💰 صندوق الحظ ============
function LuckyBox({ onWin }: { onWin: (pts: number) => void }) {
  const [opened, setOpened] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async (idx: number) => {
    if (busy || opened !== null) return;
    setBusy(true);
    const rewards = [3, 5, 8, 10, 15, 20];
    const pts = rewards[Math.floor(Math.random() * rewards.length)];
    setTimeout(() => {
      setOpened(idx);
      onWin(pts);
      setBusy(false);
    }, 500);
  };
  const reset = () => setOpened(null);
  return (
    <GameCard emoji="💰" title="صندوق الحظ" desc="افتح صندوقاً واربح نقاطاً عشوائية" gradient="from-amber-500 to-rose-600">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(idx => (
          <button key={idx} onClick={() => open(idx)} disabled={busy || opened !== null}
            className={`flex h-24 items-center justify-center rounded-2xl text-4xl transition active:scale-95 ${
              opened === idx ? "bg-gradient-to-br from-amber-400 to-rose-500 text-white animate-pulse" : "bg-secondary hover:bg-secondary/70"
            }`}>
            {busy && opened === null ? <Loader2 className="h-6 w-6 animate-spin" /> : opened === idx ? "🎉" : "📦"}
          </button>
        ))}
      </div>
      {opened !== null && (
        <button onClick={reset} className="mt-3 w-full h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground">صناديق جديدة</button>
      )}
    </GameCard>
  );
}
