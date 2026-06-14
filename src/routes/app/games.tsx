import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Gamepad2, Coins, Crown, Bot, User as UserIcon, Send, Loader2, Trophy, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/games")({
  component: GamesPage,
});

type Round = {
  id: string; status: "open" | "finished";
  started_at: string; deadline_at: string; ended_at: string | null;
  winner_id: string | null; winner_name: string | null; winner_value: number | null;
};
type Seat = { round_id: string; seat_idx: number; user_id: string | null; ai_name: string | null };
type Guess = { id: string; round_id: string; seat_idx: number; user_id: string | null; ai_name: string | null; display_name: string; value: number; created_at: string };
type SysMsg = { id: string; text_key: string; params: Record<string, unknown> | null; created_at: string };
type Profile = { id: string; username: string; avatar_url: string | null; points: number };

function GamesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [round, setRound] = useState<Round | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [waitlist, setWaitlist] = useState<{ user_id: string; joined_at: string }[]>([]);
  const [sysMsgs, setSysMsgs] = useState<SysMsg[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [guessVal, setGuessVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number>(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // 1s ticker for countdown + periodic end-check
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // call game_tick when deadline has clearly passed (every ~3s)
  useEffect(() => {
    if (!round || round.status !== "open") return;
    const deadline = new Date(round.deadline_at).getTime();
    if (now >= deadline + 1000 && now - tickRef.current > 3000) {
      tickRef.current = now;
      supabase.rpc("game_tick").then(() => {});
    }
  }, [now, round]);

  const ensureProfiles = async (ids: string[]) => {
    const missing = ids.filter(i => i && !profiles[i]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url, points").in("id", missing);
    if (!data) return;
    setProfiles(m => {
      const next = { ...m };
      data.forEach(p => (next[p.id] = p as Profile));
      return next;
    });
  };

  const loadAll = async () => {
    const { data: rounds } = await supabase
      .from("game_rounds")
      .select("id,status,started_at,deadline_at,ended_at,winner_id,winner_name,winner_value")
      .order("started_at", { ascending: false })
      .limit(1);
    const r = (rounds?.[0] as Round | undefined) ?? null;
    setRound(r);
    if (r) {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase.from("game_seats").select("*").eq("round_id", r.id),
        supabase.from("game_guesses").select("*").eq("round_id", r.id).order("created_at", { ascending: true }),
      ]);
      const seatList = (s ?? []) as Seat[];
      setSeats(seatList);
      setGuesses((g ?? []) as Guess[]);
      await ensureProfiles(seatList.map(x => x.user_id).filter(Boolean) as string[]);
    }
    const { data: w } = await supabase.from("game_waitlist").select("*").order("joined_at");
    setWaitlist(w ?? []);
    await ensureProfiles((w ?? []).map(x => x.user_id));
    const { data: msgs } = await supabase
      .from("game_system_messages").select("*").order("created_at", { ascending: false }).limit(40);
    setSysMsgs(((msgs ?? []) as SysMsg[]).reverse());
    setTimeout(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }), 50);
  };

  const loadMe = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url, points").eq("id", user.id).maybeSingle();
    if (data) setMe(data as Profile);
  };

  useEffect(() => {
    loadAll();
    loadMe();
    const ch = supabase
      .channel("games")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_seats" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_guesses" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_waitlist" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_system_messages" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user?.id ?? ""}` }, () => loadMe())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mySeat = useMemo(() => seats.find(s => s.user_id === user?.id) ?? null, [seats, user]);
  const myGuess = useMemo(() => guesses.find(g => g.user_id === user?.id) ?? null, [guesses, user]);
  const inWaitlist = useMemo(() => waitlist.some(w => w.user_id === user?.id), [waitlist, user]);
  const waitlistPos = useMemo(() => waitlist.findIndex(w => w.user_id === user?.id) + 1, [waitlist, user]);
  const secondsLeft = round ? Math.max(0, Math.ceil((new Date(round.deadline_at).getTime() - now) / 1000)) : 0;

  const join = async () => {
    if (!user) return;
    if ((me?.points ?? 0) < 10) { toast.error(t("game.no_points")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("game_join");
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      const status = (data as { status?: string })?.status;
      if (status === "waitlisted") toast.success(t("game.waitlisted"));
      else if (status === "seated") toast.success(t("game.charged"));
    }
  };

  const submitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseInt(guessVal, 10);
    if (!Number.isFinite(v) || v < 1 || v > 5) { toast.error(t("game.invalid_guess")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("game_guess", { _value: v });
    setBusy(false);
    if (error) toast.error(error.message);
    else setGuessVal("");
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const openInvite = async () => {
    if (!user) return;
    setInviteOpen(true);
    const { data: fr } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");
    const ids = (fr ?? []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    if (ids.length === 0) { setFriends([]); return; }
    const { data: ps } = await supabase.from("profiles").select("id, username, avatar_url, points").in("id", ids);
    setFriends((ps ?? []) as Profile[]);
  };
  const sendInvite = async (friendId: string) => {
    if (!user) return;
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, receiver_id: friendId,
      content: `🎮 ${t("game.invite_message")}`,
      message_type: "text",
    });
    if (error) toast.error(error.message);
    else { setInvitedIds(s => new Set(s).add(friendId)); toast.success(t("game.invite_sent")); }
  };

  const renderSeat = (idx: number) => {
    const s = seats.find(x => x.seat_idx === idx);
    const g = s ? guesses.find(x => x.seat_idx === idx && x.round_id === s.round_id) : null;
    const profile = s?.user_id ? profiles[s.user_id] : null;
    const isWinner = round?.status === "finished" && s && (
      (s.user_id && s.user_id === round.winner_id) ||
      (!s.user_id && g && g.value === round.winner_value && g.display_name === round.winner_name)
    );
    return (
      <div key={idx} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${isWinner ? "border-yellow-500/60 bg-yellow-500/10" : "border-border bg-card"}`}>
        <div className="relative">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : s?.ai_name ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-7 w-7 text-muted-foreground" />
            </div>
          ) : s?.user_id ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary font-bold">
              {(profile?.username ?? "?").charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground">
              <UserIcon className="h-6 w-6" />
            </div>
          )}
          {isWinner && <Crown className="absolute -top-2 -right-2 h-5 w-5 text-yellow-500" />}
        </div>
        <div className="text-center">
          <div className="truncate text-xs font-semibold max-w-[80px]">
            {s?.ai_name ?? profile?.username ?? t("game.empty_seat")}
          </div>
          {s?.user_id && profile && (
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Coins className="h-3 w-3" />{profile.points}
            </div>
          )}
        </div>
        <div className="min-h-[28px] rounded-full bg-secondary px-3 py-1 text-sm font-bold">
          {g ? g.value : (s ? "…" : "—")}
        </div>
      </div>
    );
  };

  const fmtSys = (m: SysMsg): string => {
    const p = m.params ?? {};
    switch (m.text_key) {
      case "game.round_started": return t("game.sys_round_started");
      case "game.user_joined": return t("game.sys_user_joined", { name: p.name });
      case "game.user_guessed": return t("game.sys_user_guessed", { name: p.name, value: p.value });
      case "game.winner": return t("game.sys_winner", { name: p.name, secret: p.secret, guess: p.guess });
      case "game.replaced_ai": return t("game.sys_replaced_ai", { name: p.name });
      default: return m.text_key;
    }
  };

  return (
    <main className="flex flex-1 flex-col pb-4">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6" />
            <h1 className="text-xl font-extrabold">{t("game.title")}</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold">
            <Coins className="h-4 w-4 text-yellow-500" />{me?.points ?? 0}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("game.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Status bar */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
          <div>
            <div className="text-xs text-muted-foreground">{t("game.round")}</div>
            <div className="font-bold">
              {round?.status === "open" ? t("game.in_progress") : round?.status === "finished" ? t("game.finished") : "—"}
            </div>
          </div>
          {round?.status === "open" && (
            <div className="text-end">
              <div className="text-xs text-muted-foreground">{t("game.time_left")}</div>
              <div className={`font-mono text-lg font-bold ${secondsLeft <= 10 ? "text-destructive" : ""}`}>{secondsLeft}s</div>
            </div>
          )}
          {round?.status === "finished" && (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Trophy className="h-5 w-5" />
              <span className="font-bold">{round.winner_name}</span>
            </div>
          )}
        </div>

        {/* Seats */}
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(renderSeat)}
        </div>

        {/* Action / input */}
        {!mySeat ? (
          <button onClick={join} disabled={busy || (me?.points ?? 0) < 10}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <Coins className="h-5 w-5" />
                {inWaitlist ? `${t("game.waiting_position")} #${waitlistPos}` : t("game.join_seat")}
              </>
            )}
          </button>
        ) : myGuess ? (
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground">{t("game.your_guess")}</div>
            <div className="text-2xl font-bold">{myGuess.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("game.wait_others")}</div>
          </div>
        ) : (
          <form onSubmit={submitGuess} className="flex items-center gap-2">
            <input type="number" min={1} max={5} value={guessVal} onChange={(e) => setGuessVal(e.target.value)}
              placeholder="1 - 5"
              className="h-12 flex-1 rounded-2xl border border-input bg-background px-4 text-center text-lg font-bold outline-none focus:border-foreground" />
            <button disabled={busy} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
            </button>
          </form>
        )}

        {/* Invite friends */}
        <button onClick={openInvite}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          {t("game.invite_friends")}
        </button>

        {(me?.points ?? 0) < 10 && !mySeat && (
          <p className="text-center text-xs text-destructive">{t("game.no_points")}</p>
        )}

        {/* Waitlist info */}
        {waitlist.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3 text-sm">
            <div className="mb-1 font-semibold">{t("game.waitlist")} ({waitlist.length})</div>
            <div className="text-xs text-muted-foreground">
              {waitlist.slice(0, 5).map(w => profiles[w.user_id]?.username ?? "…").join(" · ")}
            </div>
          </div>
        )}

        {/* Live feed */}
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">{t("game.live_feed")}</div>
          <div ref={feedRef} className="max-h-60 overflow-y-auto flex flex-col gap-1">
            {sysMsgs.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">—</p>
            ) : sysMsgs.map(m => (
              <div key={m.id} className="text-xs text-muted-foreground">{fmtSys(m)}</div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">{t("game.rules")}</p>

        {/* More mini-games */}
        <div className="mt-2">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ألعاب سريعة</h2>
          <div className="grid grid-cols-1 gap-3">
            <RockPaperScissors />
            <CoinFlip />
            <DiceRoll />
            <ReactionTest />
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setInviteOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("game.invite_friends")}</h3>
              <button onClick={() => setInviteOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            {friends.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("friends.empty")}</p>
            ) : (
              <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                {friends.map(f => {
                  const sent = invitedIds.has(f.id);
                  return (
                    <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border p-2">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">
                          {f.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 truncate text-sm font-semibold">{f.username}</div>
                      <button onClick={() => sendInvite(f.id)} disabled={sent}
                        className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
                        {sent ? t("game.invite_sent") : t("game.invite")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ===== Mini-games (local, single-player) =====

function MiniCard({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RockPaperScissors() {
  const [you, setYou] = useState<string | null>(null);
  const [bot, setBot] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const opts = [{ k: "rock", e: "✊" }, { k: "paper", e: "✋" }, { k: "scissors", e: "✌️" }];
  const play = (k: string) => {
    const b = opts[Math.floor(Math.random() * 3)];
    setYou(k); setBot(b.k);
    if (k === b.k) setResult("تعادل");
    else if ((k === "rock" && b.k === "scissors") || (k === "paper" && b.k === "rock") || (k === "scissors" && b.k === "paper"))
      setResult("فزت! 🎉");
    else setResult("خسرت 😅");
  };
  return (
    <MiniCard title="حجر · ورقة · مقص" emoji="✊">
      <div className="mb-3 flex justify-around text-4xl">
        <div className="text-center">
          <div>{you ? opts.find(o => o.k === you)?.e : "❔"}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">أنت</div>
        </div>
        <div className="text-center">
          <div>{bot ? opts.find(o => o.k === bot)?.e : "❔"}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">الخصم</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(o => (
          <button key={o.k} onClick={() => play(o.k)} className="h-12 rounded-xl bg-secondary text-2xl active:scale-95">{o.e}</button>
        ))}
      </div>
      {result && <div className="mt-3 text-center text-sm font-bold text-primary">{result}</div>}
    </MiniCard>
  );
}

function CoinFlip() {
  const [side, setSide] = useState<string>("");
  const [flipping, setFlipping] = useState(false);
  const flip = () => {
    setFlipping(true);
    setTimeout(() => { setSide(Math.random() < 0.5 ? "👑 صورة" : "✦ كتابة"); setFlipping(false); }, 600);
  };
  return (
    <MiniCard title="قذف العملة" emoji="🪙">
      <div className="mb-3 flex justify-center text-5xl">
        <span className={flipping ? "inline-block animate-spin" : ""}>🪙</span>
      </div>
      <button onClick={flip} disabled={flipping} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
        {flipping ? "..." : "اقذف"}
      </button>
      {side && <div className="mt-3 text-center text-sm font-bold text-primary">{side}</div>}
    </MiniCard>
  );
}

function DiceRoll() {
  const [val, setVal] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const faces = ["⚀","⚁","⚂","⚃","⚄","⚅"];
  const roll = () => {
    setRolling(true);
    setTimeout(() => { setVal(Math.floor(Math.random() * 6) + 1); setRolling(false); }, 500);
  };
  return (
    <MiniCard title="رمي النرد" emoji="🎲">
      <div className="mb-3 flex justify-center text-6xl">
        <span className={rolling ? "inline-block animate-bounce" : ""}>{val ? faces[val - 1] : "🎲"}</span>
      </div>
      <button onClick={roll} disabled={rolling} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
        {rolling ? "..." : "ارمِ النرد"}
      </button>
      {val && <div className="mt-3 text-center text-sm font-bold text-primary">حصلت على {val}</div>}
    </MiniCard>
  );
}

function ReactionTest() {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "done">("idle");
  const [ms, setMs] = useState<number | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    setState("waiting"); setMs(null);
    const delay = 1000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => { startRef.current = Date.now(); setState("go"); }, delay);
  };
  const click = () => {
    if (state === "waiting") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState("idle"); setMs(-1);
    } else if (state === "go") {
      setMs(Date.now() - startRef.current);
      setState("done");
    } else { start(); }
  };
  const bg = state === "waiting" ? "bg-red-600" : state === "go" ? "bg-green-600" : "bg-secondary";
  return (
    <MiniCard title="اختبار سرعة الاستجابة" emoji="⚡">
      <button onClick={click} className={`h-28 w-full rounded-xl ${bg} text-lg font-bold text-white transition`}>
        {state === "idle" && "اضغط للبدء"}
        {state === "waiting" && "انتظر اللون الأخضر…"}
        {state === "go" && "اضغط الآن!"}
        {state === "done" && `${ms} ms — اضغط للإعادة`}
      </button>
      {ms === -1 && <div className="mt-2 text-center text-xs text-destructive">كان مبكراً!</div>}
    </MiniCard>
  );
}

