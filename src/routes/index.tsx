import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LogIn, MessageCircle, Users, Music, Sparkles, Download, Shield, Zap,
  CheckCircle2, Gift, Trophy, Bell, Heart, Star, Globe, Lock,
} from "lucide-react";
import PermissionsGate, { hasCompletedPermissionsGate } from "@/components/PermissionsGate";
import siteChat from "@/assets/site-chat.jpg";
import siteRooms from "@/assets/site-rooms.jpg";
import siteMusic from "@/assets/site-music.jpg";
import siteProfile from "@/assets/site-profile.jpg";
import siteGames from "@/assets/site-games.jpg";
import siteStore from "@/assets/site-store.jpg";
import siteCommunity from "@/assets/site-community.jpg";
import siteNotifications from "@/assets/site-notifications.jpg";

declare const __CAPACITOR_BUILD__: boolean | undefined;

// Local bundled media — shipped inside the APK assets folder and the web build.
const WELCOME_VIDEO = "/media/welcome-video.mp4";
const WELCOME_POSTER = "/media/welcome-poster.jpg";

export const Route = createFileRoute("/")({
  component: Welcome,
  head: () => ({
    meta: [
      { title: "Giant — حمّل التطبيق الآن" },
      { name: "description", content: "Giant — تطبيق دردشة وغرف صوتية وموسيقى وهدايا. حمّل أحدث إصدار APK مباشرة." },
      { property: "og:title", content: "Giant — الموقع الرسمي" },
      { property: "og:description", content: "حمّل تطبيق Giant مباشرة من الموقع الرسمي." },
    ],
    links: [
      { rel: "preload", as: "video", href: WELCOME_VIDEO, type: "video/mp4" },
      { rel: "preload", as: "image", href: WELCOME_POSTER },
    ],
  }),
});

function Welcome() {
  const isNativeApp = typeof __CAPACITOR_BUILD__ !== "undefined" && __CAPACITOR_BUILD__;
  if (!isNativeApp) return <PublicWebsite />;
  return <NativeWelcome />;
}

function NativeWelcome() {
  const navigate = useNavigate();
  const [needsPerms, setNeedsPerms] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { setNeedsPerms(!hasCompletedPermissionsGate()); }, []);

  const guardedNavigate = (to: "/login" | "/register") => {
    if (!hasCompletedPermissionsGate()) { setNeedsPerms(true); return; }
    navigate({ to });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
        navigate({ to: "/app/friends", replace: true });
      } else {
        setSessionChecked(true);
      }
    });
  }, [navigate]);

  if (!sessionChecked || hasSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <span aria-label="loading" className="block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-8 text-foreground">
      {needsPerms && <PermissionsGate onDone={() => setNeedsPerms(false)} />}
      <video ref={videoRef} src={WELCOME_VIDEO} poster={WELCOME_POSTER} autoPlay loop muted playsInline preload="auto" aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-70" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-background/70 via-background/40 to-background/95" />
      <div className="relative z-10 mt-6 flex flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-primary to-success shadow-2xl ring-4 ring-card">
          <span className="text-4xl font-black text-primary-foreground drop-shadow">G</span>
          <Sparkles className="absolute -top-2 -end-2 h-5 w-5 animate-pulse text-primary" />
        </div>
        <h1 className="mt-4 bg-gradient-to-b from-foreground to-primary bg-clip-text text-5xl font-black tracking-tight text-transparent">Giant</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">دردش • شارك • العب — مجتمعك في مكان واحد</p>
      </div>
      <div className="flex-1" />
      <div className="relative z-10 mx-auto w-full max-w-sm space-y-3">
        <button type="button" onClick={() => guardedNavigate("/login")} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98]">
          <LogIn className="h-5 w-5" /> تسجيل الدخول
        </button>
        <button type="button" onClick={() => guardedNavigate("/register")} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-bold text-foreground transition active:scale-[0.98] hover:bg-accent">
          إنشاء حساب جديد
        </button>
      </div>
    </main>
  );
}

/* ============================================================
   Public Website (Browsers only — not shown inside the APK).
   - No login / register / app routes exposed.
   - Single CTA: download the latest APK directly.
   - Version history & changelogs are NOT shown here; they live inside the APK.
   ============================================================ */

function PublicWebsite() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("app_updates")
          .select("version, file_url, file_size")
          .eq("is_active", true)
          .order("version_code", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || !data) return;
        setDownloadUrl(data.file_url);
        setVersion(data.version);
        setSize(data.file_size);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sizeMb = size && size > 0 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : "";

  const DownloadButton = ({ large = false }: { large?: boolean }) => {
    if (loading) {
      return <div className={`animate-pulse rounded-2xl bg-card ${large ? "h-16 w-full max-w-sm" : "h-11 w-32"}`} />;
    }
    if (!downloadUrl) {
      return <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">سيتوفّر التحميل قريباً</div>;
    }
    if (large) {
      return (
        <a href={downloadUrl} download className="group relative flex h-16 w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-emerald-500 to-success px-6 text-lg font-extrabold text-primary-foreground shadow-xl shadow-primary/40 transition hover:scale-[1.02] active:scale-[0.98]">
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          <Download className="h-6 w-6" />
          <span className="flex flex-col items-start leading-tight">
            <span>تحميل التطبيق مباشرة</span>
            {version && <span className="text-[11px] font-medium opacity-90">آخر إصدار v{version}{sizeMb && ` • ${sizeMb}`}</span>}
          </span>
        </a>
      );
    }
    return (
      <a href={downloadUrl} download className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition hover:opacity-90">
        <Download className="h-4 w-4" /> تحميل
      </a>
    );
  };

  const features = [
    { Icon: MessageCircle, title: "محادثات فورية", desc: "دردشات خاصة وجماعية لحظية مع صور وفيديو ورسائل صوتية، تجربة سلسة بإشعارات مباشرة.", img: siteChat },
    { Icon: Users, title: "غرف صوتية حية", desc: "ادخل غرفاً صوتية متعددة المتحدثين، أنشئ غرفتك الخاصة، وتفاعل مع جمهورك مباشرة.", img: siteRooms },
    { Icon: Music, title: "موسيقى مشتركة", desc: "شغّل الأغاني داخل الغرف ومع أصدقائك، مع مزامنة لحظية ومؤثرات بصرية رائعة.", img: siteMusic },
    { Icon: Trophy, title: "ملف شخصي وإنجازات", desc: "اصنع هويتك بشارات، إطارات، وإنجازات وارتقِ بالمستوى يومياً.", img: siteProfile },
    { Icon: Sparkles, title: "ألعاب ومسابقات", desc: "ألعاب ممتعة داخل التطبيق، لوحات شرف، وجوائز يومية للمتفوقين.", img: siteGames },
    { Icon: Gift, title: "متجر الهدايا الفاخر", desc: "هدايا متحركة بتصميم احترافي، عناصر مميزة، وعروض حصرية بشكل دوري.", img: siteStore },
    { Icon: Heart, title: "مجتمع نابض", desc: "منشورات، قصص يومية، تعليقات وردود فعل تجمعك مع أصدقائك في تجربة واحدة.", img: siteCommunity },
    { Icon: Bell, title: "إشعارات ذكية", desc: "تنبيهات لحظية للرسائل، الطلبات، التفاعلات — كل شيء بمكان واحد منظم.", img: siteNotifications },
  ];

  return (
    <main className="min-h-dvh bg-background text-foreground" dir="rtl">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-lg font-black text-primary-foreground shadow-lg shadow-primary/30">G</div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-tight">Giant</span>
              <span className="text-[10px] font-medium text-muted-foreground">الموقع الرسمي</span>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground">المميزات</a>
            <a href="#gallery" className="hover:text-foreground">داخل التطبيق</a>
            <a href="#download" className="hover:text-foreground">التحميل</a>
            <Link to="/privacy" className="hover:text-foreground">الخصوصية</Link>
          </nav>
          <DownloadButton />
        </div>
      </header>

      {/* Hero */}
      <section id="download" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> الموقع الرسمي للتطبيق
            </span>
            <h1 className="bg-gradient-to-b from-foreground via-foreground to-primary bg-clip-text text-5xl font-black leading-[1.1] tracking-tight text-transparent md:text-7xl">
              Giant
              <br />
              <span className="text-3xl md:text-5xl">مجتمعك الكامل في تطبيق واحد</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              دردشات لحظية، غرف صوتية حية، موسيقى مشتركة، هدايا، إنجازات وألعاب —
              كل شيء بتجربة عربية واحدة سريعة وأنيقة.
            </p>

            <div className="mt-9 flex flex-col gap-3">
              <DownloadButton large />
              <a href="/watch" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-5 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition">
                ▶ شاهد الفيديو التعريفي
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                التحديثات تصلك تلقائياً داخل التطبيق بعد التثبيت • متوافق مع Android 7+
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
              <div className="rounded-2xl border border-border bg-card/50 p-3.5">
                <Zap className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                <span className="font-semibold">سريع وخفيف</span>
              </div>
              <div className="rounded-2xl border border-border bg-card/50 p-3.5">
                <Shield className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                <span className="font-semibold">آمن وموثوق</span>
              </div>
              <div className="rounded-2xl border border-border bg-card/50 p-3.5">
                <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                <span className="font-semibold">تحديثات تلقائية</span>
              </div>
            </div>
          </div>

          {/* Hero phone */}
          <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/40 via-emerald-400/15 to-transparent blur-3xl" />
            <img src={siteChat} alt="Giant app" width={832} height={1216} className="w-full rounded-[2.5rem] border border-border/60 shadow-2xl shadow-primary/20" />
            <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="ms-1 text-foreground">4.9 / 5</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {[
            { num: "+50K", label: "مستخدم نشط" },
            { num: "+1M", label: "رسالة يومية" },
            { num: "+5K", label: "غرفة صوتية" },
            { num: "99.9%", label: "وقت تشغيل" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="bg-gradient-to-b from-primary to-emerald-400 bg-clip-text text-3xl font-black text-transparent md:text-4xl">{s.num}</div>
              <div className="mt-1 text-xs font-medium text-muted-foreground md:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features (zigzag) */}
      <section id="features" className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="mb-16 text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">المميزات</span>
            <h2 className="text-3xl font-black md:text-5xl">كل ما يحتاجه مجتمعك</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">مجموعة متكاملة من الأدوات صُممت لتجعل تواصلك أكثر متعة وحيوية.</p>
          </div>

          <div className="space-y-24">
            {features.map((f, i) => (
              <div key={f.title} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                    <f.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-extrabold md:text-3xl">{f.title}</h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
                <div className="relative mx-auto w-full max-w-xs">
                  <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/25 to-transparent blur-2xl" />
                  <img src={f.img} alt={f.title} width={832} height={1216} loading="lazy" className="w-full rounded-3xl border border-border/60 shadow-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="border-b border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">داخل التطبيق</span>
            <h2 className="text-3xl font-black md:text-4xl">لقطات حقيقية من التطبيق</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">تصفّح كل جانب من جوانب Giant قبل أن تجرّبه بنفسك.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[siteChat, siteRooms, siteMusic, siteProfile, siteGames, siteStore, siteCommunity, siteNotifications].map((src, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
                <img src={src} alt="" width={832} height={1216} loading="lazy" className="aspect-[3/4] w-full object-cover transition group-hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-3">
          {[
            { Icon: Lock, title: "خصوصية كاملة", desc: "محادثاتك ومعلوماتك محمية بأحدث معايير الأمان." },
            { Icon: Globe, title: "عربي بالكامل", desc: "تصميم يدعم RTL بالكامل بتجربة عربية أصيلة." },
            { Icon: Zap, title: "أداء فائق", desc: "محسّن ليعمل بسلاسة حتى على الأجهزة الأقدم." },
          ].map((t) => (
            <div key={t.title} className="rounded-3xl border border-border bg-card/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <t.Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/15 via-background to-emerald-500/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,theme(colors.primary/0.15),transparent_70%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center">
          <h2 className="text-3xl font-black md:text-5xl">جاهز لتبدأ؟</h2>
          <p className="mt-4 max-w-lg text-muted-foreground">حمّل Giant الآن واستمتع بتجربة مجتمع كاملة على هاتفك.</p>
          <div className="mt-8 flex justify-center">
            <DownloadButton large />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-xs font-black text-primary-foreground">G</div>
            <span className="font-bold text-foreground">Giant</span>
          </div>
          <span>© {new Date().getFullYear()} Giant. جميع الحقوق محفوظة.</span>
        </div>
      </footer>
    </main>
  );
}
