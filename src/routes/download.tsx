import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Sparkles, MessageCircle, Users, Music, Trophy, Shield, Zap, CheckCircle2, Calendar, Package } from "lucide-react";
import siteChat from "@/assets/site-chat.jpg";
import siteRooms from "@/assets/site-rooms.jpg";
import siteMusic from "@/assets/site-music.jpg";
import siteProfile from "@/assets/site-profile.jpg";

export const Route = createFileRoute("/download")({
  component: SitePage,
  head: () => ({
    meta: [
      { title: "Giant — حمّل التطبيق وتعرّف على جميع الإصدارات" },
      { name: "description", content: "الموقع الرسمي لتطبيق Giant — حمّل أحدث إصدار APK، استعرض جميع الإصدارات السابقة، وتعرّف على ميزات التطبيق." },
      { property: "og:title", content: "Giant — الموقع الرسمي" },
      { property: "og:description", content: "حمّل تطبيق Giant — دردشة، غرف صوتية، موسيقى، هدايا، وأكثر." },
    ],
  }),
});

type UpdateRow = {
  id: string;
  version: string;
  version_code: number;
  file_url: string;
  file_size: number | null;
  update_message: string | null;
  created_at: string;
  is_active: boolean;
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
}

function SitePage() {
  const [versions, setVersions] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("app_updates")
          .select("id, version, version_code, file_url, file_size, update_message, created_at, is_active")
          .eq("is_active", true)
          .order("version_code", { ascending: false })
          .limit(50);
        if (cancelled) return;
        if (error) throw error;
        setVersions((data || []) as UpdateRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذر جلب الإصدارات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const latest = versions[0];
  const older = versions.slice(1);

  const features = [
    { Icon: MessageCircle, title: "محادثات فورية", desc: "دردشات خاصة وجماعية فورية مع إشعارات لحظية، صور، فيديو، ورسائل صوتية بتجربة سلسة.", img: siteChat },
    { Icon: Users, title: "غرف صوتية ومجتمعات", desc: "أنشئ غرفك الصوتية واجمع أصدقاءك ومجتمعك، مع نظام مشرفين متقدم وتفاعل مباشر.", img: siteRooms },
    { Icon: Music, title: "موسيقى وهدايا", desc: "شارك الأغاني داخل الغرف، أرسل هدايا متحركة، واستمتع بمؤثرات بصرية مذهلة.", img: siteMusic },
    { Icon: Trophy, title: "ملف شخصي وإنجازات", desc: "اصنع هويتك بشارات وإطارات وإنجازات، وارتقِ بالمستوى عبر تفاعلك اليومي.", img: siteProfile },
  ];

  return (
    <main className="min-h-dvh bg-background text-foreground" dir="rtl">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-lg font-black text-primary-foreground shadow-lg shadow-primary/30">
              G
            </div>
            <span className="text-lg font-extrabold tracking-tight">Giant</span>
          </div>
          <nav className="hidden gap-6 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground">المميزات</a>
            <a href="#download" className="hover:text-foreground">التحميل</a>
            <a href="#versions" className="hover:text-foreground">الإصدارات</a>
          </nav>
          {latest && (
            <a
              href={latest.file_url}
              className="hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition hover:opacity-90 sm:flex"
            >
              <Download className="h-4 w-4" /> تحميل
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section id="download" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> الموقع الرسمي للتطبيق
            </span>
            <h1 className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent md:text-6xl">
              Giant — مجتمعك الكامل في تطبيق واحد
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              دردشات، غرف صوتية، موسيقى، هدايا، إنجازات — كل ما تحتاجه للتواصل واللعب
              والتفاعل مع أصدقائك في تجربة واحدة سريعة وأنيقة.
            </p>

            {/* Primary CTA */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {loading ? (
                <div className="h-16 w-full max-w-sm animate-pulse rounded-2xl bg-card" />
              ) : latest ? (
                <a
                  href={latest.file_url}
                  className="group flex h-16 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 px-6 text-lg font-extrabold text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="h-6 w-6 transition group-hover:translate-y-0.5" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>تحميل آخر إصدار</span>
                    <span className="text-xs font-medium opacity-90">
                      v{latest.version} {formatSize(latest.file_size) && `• ${formatSize(latest.file_size)}`}
                    </span>
                  </span>
                </a>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  لا توجد إصدارات متاحة حالياً.
                </div>
              )}
            </div>

            {latest && (
              <p className="mt-3 text-xs text-muted-foreground">
                صدر في {formatDate(latest.created_at)} • متوافق مع Android
              </p>
            )}

            <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <Zap className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span>سريع وخفيف</span>
              </div>
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <Shield className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span>آمن وموثوق</span>
              </div>
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span>تحديثات تلقائية</span>
              </div>
            </div>
          </div>

          {/* Hero phone */}
          <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/30 to-emerald-400/10 blur-2xl" />
            <img
              src={siteChat}
              alt="Giant app screenshot"
              width={640}
              height={1024}
              className="w-full rounded-[2.5rem] border border-border/60 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-black md:text-4xl">كل ما يحتاجه مجتمعك</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              مجموعة متكاملة من الأدوات صُممت لتجعل تواصلك أكثر متعة وحيوية.
            </p>
          </div>

          <div className="space-y-20">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
              >
                <div>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <f.Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-extrabold md:text-3xl">{f.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
                <div className="relative mx-auto w-full max-w-xs">
                  <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
                  <img
                    src={f.img}
                    alt={f.title}
                    width={640}
                    height={1024}
                    loading="lazy"
                    className="w-full rounded-3xl border border-border/60 shadow-xl"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Versions */}
      <section id="versions" className="border-t border-border/60">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black md:text-4xl">جميع الإصدارات</h2>
            <p className="mt-3 text-muted-foreground">آخر الإصدارات تظهر في الأعلى — يتم التحديث تلقائياً.</p>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && latest && (
            <>
              {/* Latest highlighted */}
              <div className="mb-4 rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-6 shadow-lg shadow-primary/10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      <Sparkles className="h-3 w-3" /> الأحدث
                    </span>
                    <h3 className="mt-2 text-2xl font-black">v{latest.version}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(latest.created_at)}</span>
                      {formatSize(latest.file_size) && (
                        <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{formatSize(latest.file_size)}</span>
                      )}
                    </div>
                    {latest.update_message && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{latest.update_message}</p>
                    )}
                  </div>
                  <a
                    href={latest.file_url}
                    className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition hover:opacity-90"
                  >
                    <Download className="h-4 w-4" /> تحميل
                  </a>
                </div>
              </div>

              {/* Older */}
              {older.length > 0 && (
                <div className="space-y-3">
                  {older.map((v) => (
                    <div
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold">v{v.version}</h4>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(v.created_at)}</span>
                          {formatSize(v.file_size) && (
                            <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{formatSize(v.file_size)}</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={v.file_url}
                        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-bold transition hover:border-primary hover:text-primary"
                      >
                        <Download className="h-3.5 w-3.5" /> تحميل
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !error && !latest && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
              لا توجد إصدارات منشورة بعد.
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-400 text-xs font-black text-primary-foreground">
              G
            </div>
            <span className="font-bold text-foreground">Giant</span>
          </div>
          <span>© {new Date().getFullYear()} Giant. جميع الحقوق محفوظة.</span>
        </div>
      </footer>
    </main>
  );
}
