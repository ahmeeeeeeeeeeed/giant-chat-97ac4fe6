import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Star, Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteAuthProvider, useSiteAuth } from "@/lib/site-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/reviews")({
  component: ReviewsRoute,
  head: () => ({
    meta: [
      { title: "تقييمات تطبيق Giant — شارك رأيك" },
      { name: "description", content: "اقرأ تقييمات المستخدمين لتطبيق Giant واكتب تقييمك بالنجوم والتعليق — باسمك أو بمجهول." },
      { property: "og:title", content: "تقييمات Giant" },
      { property: "og:description", content: "تقييمات وتعليقات المستخدمين لتطبيق Giant." },
    ],
  }),
});

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
  user_id: string | null;
};

function ReviewsRoute() {
  return (
    <SiteAuthProvider>
      <ReviewsPage />
    </SiteAuthProvider>
  );
}

function ReviewsPage() {
  const { user, loading: authLoading } = useSiteAuth();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_reviews" as never)
      .select("id,rating,comment,display_name,is_anonymous,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setReviews((data as unknown as Review[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const n = list.length;
    const avg = n ? list.reduce((s, r) => s + r.rating, 0) / n : 0;
    const dist = [0, 0, 0, 0, 0];
    for (const r of list) dist[r.rating - 1] = (dist[r.rating - 1] || 0) + 1;
    return { n, avg, dist };
  }, [reviews]);

  return (
    <main dir="rtl" className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-6 w-6 rtl:rotate-180" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-bold">تقييمات Giant</span>
          </div>
          <span className="w-6" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        {/* Summary */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="text-center">
              <div className="text-5xl font-black tracking-tight sm:text-6xl">{stats.avg.toFixed(1)}</div>
              <StarRow value={Math.round(stats.avg)} size={20} />
              <div className="mt-1 text-xs text-muted-foreground">{stats.n} تقييم</div>
            </div>
            <div className="w-full flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const c = stats.dist[s - 1] || 0;
                const pct = stats.n ? (c / stats.n) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-3 text-xs">
                    <span className="w-3 font-bold">{s}</span>
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-end text-muted-foreground">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="mt-8">
          {authLoading ? null : user ? (
            <ReviewComposer user={user} onPosted={load} />
          ) : (
            <SignInPrompt />
          )}
        </div>

        {/* Reviews list */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-extrabold">آراء المستخدمين</h2>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (reviews && reviews.length > 0) ? (
            <ul className="space-y-4">
              {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            </ul>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 py-14 text-center text-muted-foreground">
              لا توجد تقييمات بعد — كن أول من يكتب رأيه ✨
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6 text-center">
      <h3 className="text-lg font-extrabold">سجّل دخولك لكتابة تقييم</h3>
      <p className="mt-1 text-sm text-muted-foreground">حساب الموقع منفصل عن حساب التطبيق ويُستخدم فقط للتقييمات والتعليقات.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link to="/site/login" className="rounded-2xl bg-gradient-to-r from-primary to-emerald-500 px-5 py-2.5 font-bold text-primary-foreground shadow-lg shadow-primary/30">دخول</Link>
        <Link to="/site/register" className="rounded-2xl border border-border bg-background px-5 py-2.5 font-bold hover:bg-accent">إنشاء حساب</Link>
      </div>
    </div>
  );
}

function ReviewComposer({ user, onPosted }: { user: { id: string; email?: string; user_metadata?: any }; onPosted: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);

  const niceName = (user.user_metadata?.display_name as string | undefined) || (user.email ? user.email.split("@")[0] : "مستخدم");

  const submit = async () => {
    if (!rating) return toast.error("اختر عدد النجوم");
    setBusy(true);
    const display_name = anon ? "مجهول" : niceName;
    const { error } = await supabase.from("app_reviews" as never).insert({
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
      display_name,
      is_anonymous: anon,
    } as never);
    setBusy(false);
    if (error) return toast.error("تعذّر النشر، حاول مرة أخرى");
    toast.success("شكراً لتقييمك ⭐");
    setRating(0); setComment(""); setAnon(false);
    onPosted();
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-extrabold">شاركنا رأيك</h3>
      <p className="mt-1 text-xs text-muted-foreground">تقييمك يساعد الآخرين ويساعدنا على التحسين.</p>

      <div className="mt-4 flex items-center gap-1.5" dir="ltr" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || rating) >= n;
          return (
            <button
              key={n} type="button" aria-label={`${n} نجوم`}
              onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
              className="p-1 transition active:scale-90"
            >
              <Star className={`h-9 w-9 transition ${active ? "fill-yellow-400 text-yellow-400 drop-shadow" : "text-muted-foreground/40"}`} />
            </button>
          );
        })}
      </div>

      <textarea
        value={comment} onChange={(e) => setComment(e.target.value)}
        maxLength={1000} rows={4}
        placeholder="اكتب تعليقاً (اختياري)…"
        className="mt-4 w-full resize-none rounded-2xl border border-input bg-background p-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-1 text-end text-[11px] text-muted-foreground">{comment.length}/1000</div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="h-4 w-4 accent-primary" />
          <span>نشر بمجهول</span>
          {!anon && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">سيظهر باسم: <b className="text-foreground">{niceName}</b></span>
          )}
        </label>
        <button
          onClick={submit} disabled={busy || !rating}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-500 px-5 py-2.5 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} نشر التقييم
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
  const name = review.is_anonymous ? "مجهول" : (review.display_name || "مستخدم");
  const initial = name.charAt(0).toUpperCase();
  return (
    <li className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white ${review.is_anonymous ? "bg-gradient-to-br from-slate-500 to-slate-700" : "bg-gradient-to-br from-primary to-emerald-500"}`}>
          {review.is_anonymous ? "؟" : initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate font-bold">{name}</span>
            <StarRow value={review.rating} size={14} />
            <span className="text-[11px] text-muted-foreground">{date}</span>
          </div>
          {review.comment && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{review.comment}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

