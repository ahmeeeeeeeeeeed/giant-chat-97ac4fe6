import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LogIn, MessageCircle, Users, Music, Sparkles, Download, Shield, Zap,
  CheckCircle2, Gift, Trophy, Bell, Heart, Star, Globe, Lock,
  ArrowRight, Loader2, Phone, Video, ShieldCheck, Wifi,
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
import siteCallAudio from "@/assets/site-call-audio.jpg";
import siteCallVideo from "@/assets/site-call-video.jpg";

declare const __CAPACITOR_BUILD__: boolean | undefined;

// Local bundled media — shipped inside the APK assets folder and the web build.
const WELCOME_VIDEO = "/media/welcome-video.mp4";
const WELCOME_POSTER = "/media/welcome-poster.jpg";

export const Route = createFileRoute("/")({
  component: Welcome,
  head: () => ({
    meta: [
      { title: "Giant — مكالمات صوتية وفيديو مجانية، دردشة وغرف وألعاب" },
      { name: "description", content: "Giant: تطبيق عربي للمكالمات الصوتية والفيديو المجانية، دردشة فورية، غرف صوتية حية، ألعاب وتحديات ومكافآت يومية. تواصل مع عائلتك وأصدقائك بجودة عالية واستقرار دائم." },
      { name: "keywords", content: "تطبيق مكالمات مجانية, مكالمات فيديو مجانية, مكالمات صوتية, تطبيق دردشة عربي, شات عربي, غرف صوتية, غرف دردشة, تطبيق محادثات, ألعاب اونلاين, تحديات ومكافآت, تواصل مع العائلة, تطبيق اتصال مجاني, video call free, voice call app, Arabic chat app, Giant chat, جيانت, تطبيق جيانت" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Giant — مكالمات وفيديو ودردشة مجانية" },
      { property: "og:description", content: "اتصل مجاناً صوت وفيديو، دردش في غرف حية، العب واربح مكافآت يومية مع عائلتك وأصدقائك." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://giant-chat.lovable.app/" },
      { property: "og:image", content: "https://giant-chat.lovable.app/icons/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Giant — مكالمات وفيديو ودردشة مجانية" },
      { name: "twitter:description", content: "مكالمات صوت وفيديو مجانية، غرف دردشة، ألعاب وتحديات ومكافآت." },
      { name: "twitter:image", content: "https://giant-chat.lovable.app/icons/icon-512.png" },
    ],
    links: [
      { rel: "canonical", href: "https://giant-chat.lovable.app/" },
      { rel: "preload", as: "video", href: WELCOME_VIDEO, type: "video/mp4" },
      { rel: "preload", as: "image", href: WELCOME_POSTER },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          name: "Giant",
          operatingSystem: "ANDROID",
          applicationCategory: "SocialNetworkingApplication",
          description: "تطبيق عربي للمكالمات الصوتية والفيديو المجانية والدردشة والغرف الصوتية والألعاب والمكافآت.",
          inLanguage: "ar",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "120" },
          keywords: "مكالمات مجانية, مكالمات فيديو, دردشة, غرف صوتية, ألعاب, تحديات, مكافآت",
        }),
      },
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

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
};

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
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

function HomeReviewsPreview() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("app_reviews" as never)
        .select("id,rating,comment,display_name,is_anonymous,created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!cancelled) {
        setReviews((data as unknown as Review[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 py-10 text-center text-muted-foreground">
        لا توجد تقييمات بعد — <Link to="/reviews" className="font-bold text-primary underline">كن أول من يقيّم</Link>
      </div>
    );
  }

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4">
        <div className="text-4xl font-black">{avg.toFixed(1)}</div>
        <div>
          <StarRow value={Math.round(avg)} size={18} />
          <div className="mt-0.5 text-xs text-muted-foreground">بناءً على {reviews.length} تقييم</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => {
          const name = r.is_anonymous ? "مجهول" : (r.display_name || "مستخدم");
          const initial = name.charAt(0).toUpperCase();
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white ${r.is_anonymous ? "bg-gradient-to-br from-slate-500 to-slate-700" : "bg-gradient-to-br from-primary to-emerald-500"}`}>
                  {r.is_anonymous ? "؟" : initial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{name}</div>
                  <StarRow value={r.rating} size={12} />
                </div>
              </div>
              {r.comment && (
                <p className="mt-3 text-sm leading-relaxed text-foreground/80 line-clamp-3">{r.comment}</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PublicWebsite() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

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

  const startDownload = () => {
    if (!downloadUrl) return;
    setStarting(true);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      setStarting(false);
      setConfirmOpen(false);
    }, 1200);
  };

  const DownloadButton = ({ large = false }: { large?: boolean }) => {
    if (loading) {
      return <div className={`animate-pulse rounded-2xl bg-card ${large ? "h-16 w-full max-w-sm" : "h-11 w-32"}`} />;
    }
    if (!downloadUrl) {
      return <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">سيتوفّر التحميل قريباً</div>;
    }
    if (large) {
      return (
        <button type="button" onClick={() => setConfirmOpen(true)} className="group relative flex h-16 w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-emerald-500 to-success px-6 text-lg font-extrabold text-primary-foreground shadow-xl shadow-primary/40 transition hover:scale-[1.02] active:scale-[0.98]">
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          <Download className="h-6 w-6" />
          <span className="flex flex-col items-start leading-tight">
            <span>تحميل التطبيق مباشرة</span>
            {version && <span className="text-[11px] font-medium opacity-90">آخر إصدار v{version}{sizeMb && ` • ${sizeMb}`}</span>}
          </span>
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setConfirmOpen(true)} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition hover:opacity-90">
        <Download className="h-4 w-4" /> تحميل
      </button>
    );
  };

  const features = [
    { slug: "chat", Icon: MessageCircle, title: "محادثات فورية", desc: "دردشات خاصة وجماعية لحظية مع صور وفيديو ورسائل صوتية، تجربة سلسة بإشعارات مباشرة.", img: siteChat },
    { slug: "rooms", Icon: Users, title: "غرف صوتية حية", desc: "ادخل غرفاً صوتية متعددة المتحدثين، أنشئ غرفتك الخاصة، وتفاعل مع جمهورك مباشرة.", img: siteRooms },
    { slug: "music", Icon: Music, title: "موسيقى مشتركة", desc: "شغّل الأغاني داخل الغرف ومع أصدقائك، مع مزامنة لحظية ومؤثرات بصرية رائعة.", img: siteMusic },
    { slug: "profile", Icon: Trophy, title: "ملف شخصي وإنجازات", desc: "اصنع هويتك بشارات، إطارات، وإنجازات وارتقِ بالمستوى يومياً.", img: siteProfile },
    { slug: "games", Icon: Sparkles, title: "ألعاب ومسابقات", desc: "ألعاب ممتعة داخل التطبيق، لوحات شرف، وجوائز يومية للمتفوقين.", img: siteGames },
    { slug: "store", Icon: Gift, title: "متجر الهدايا الفاخر", desc: "هدايا متحركة بتصميم احترافي، عناصر مميزة، وعروض حصرية بشكل دوري.", img: siteStore },
    { slug: "community", Icon: Heart, title: "مجتمع نابض", desc: "منشورات، قصص يومية، تعليقات وردود فعل تجمعك مع أصدقائك في تجربة واحدة.", img: siteCommunity },
    { slug: "notifications", Icon: Bell, title: "إشعارات ذكية", desc: "تنبيهات لحظية للرسائل، الطلبات، التفاعلات — كل شيء بمكان واحد منظم.", img: siteNotifications },
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
            <Link to="/reviews" className="hover:text-foreground">التقييمات</Link>
            <Link to="/privacy" className="hover:text-foreground">الخصوصية</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/reviews" className="inline-flex rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent sm:hidden">التقييمات</Link>
            <Link to="/site/login" className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-primary/20 sm:px-4">دخول الموقع</Link>
            <a href="#download" className="flex h-11 items-center gap-2 rounded-xl border border-primary/40 bg-card px-4 text-sm font-bold text-primary transition hover:bg-primary/10">
              <Download className="h-4 w-4" /> تحميل
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
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
              <a href="#features" className="group relative flex h-16 w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-emerald-500 to-success px-6 text-lg font-extrabold text-primary-foreground shadow-xl shadow-primary/40 transition hover:scale-[1.02] active:scale-[0.98]">
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                <Sparkles className="h-6 w-6" />
                <span className="flex flex-col items-start leading-tight">
                  <span>اكتشف مميزات Giant</span>
                  <span className="text-[11px] font-medium opacity-90">تصفّح المميزات ثم حمّل التطبيق</span>
                </span>
              </a>


              <Link to="/reviews" className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-5 py-2.5 text-sm font-bold text-yellow-500 transition hover:bg-yellow-400/20">
                <span className="flex items-center gap-1" dir="ltr">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </span>
                <span>قيّم التطبيق الآن</span>
              </Link>

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

      {/* Reviews preview */}
      <section id="reviews" className="border-b border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-10 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-start">
            <div>
              <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">تقييمات المستخدمين</span>
              <h2 className="text-2xl font-black md:text-3xl">ماذا يقول مستخدمو Giant؟</h2>
            </div>
            <Link to="/reviews" className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-bold transition hover:bg-accent">
              كل التقييمات <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
          <HomeReviewsPreview />
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
                  <Link to="/features/$slug" params={{ slug: f.slug }} className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/20">
                    اعرف المزيد عن مهام هذا الزر <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                </div>
                <Link to="/features/$slug" params={{ slug: f.slug }} className="relative mx-auto block w-full max-w-xs transition hover:scale-[1.02]">
                  <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/25 to-transparent blur-2xl" />
                  <img src={f.img} alt={f.title} width={832} height={1216} loading="lazy" className="w-full rounded-3xl border border-border/60 shadow-xl" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calls feature */}
      <section id="calls" className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-emerald-950/30 via-background to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,theme(colors.emerald.500/0.15),transparent_55%),radial-gradient(circle_at_85%_70%,theme(colors.cyan.500/0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              <Phone className="h-3 w-3" /> جديد
            </span>
            <h2 className="text-3xl font-black md:text-4xl">مكالمات صوت وفيديو احترافية</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              اتصل بأصدقائك مجاناً بدقة عالية وزمن استجابة منخفض — مكالمات حقيقية مبنية على WebRTC مباشرة بين الأجهزة، بدون أي رسوم أو وسطاء.
            </p>
          </div>

          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="relative order-2 md:order-1">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl" />
              <img
                src={siteCallAudio}
                alt="مكالمة صوتية داخل تطبيق Giant"
                width={832}
                height={1216}
                loading="lazy"
                className="mx-auto w-full max-w-sm rounded-[2rem] border border-emerald-500/20 shadow-2xl shadow-emerald-500/20"
              />
            </div>
            <div className="order-1 md:order-2 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Phone className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-wider">مكالمات صوتية</span>
              </div>
              <h3 className="text-2xl font-black">صوت نقي بدون تشويش</h3>
              <p className="text-muted-foreground leading-relaxed">
                تقنيات حذف الضوضاء وإلغاء الصدى المدمجة تضمن لك مكالمة صوتية واضحة حتى في الأماكن المزدحمة. يكفي زر واحد لتسمع صديقك.
              </p>
              <ul className="space-y-2.5 text-sm">
                <Feat icon={CheckCircle2}>اتصال فوري من داخل المحادثة الخاصة</Feat>
                <Feat icon={CheckCircle2}>نغمة رنين حقيقية وإشعار وارد على أي شاشة</Feat>
                <Feat icon={CheckCircle2}>كتم الميكروفون وتفعيل السماعة بضغطة واحدة</Feat>
                <Feat icon={CheckCircle2}>سجل مكالمات كامل: واردة، صادرة، فائتة</Feat>
              </ul>
            </div>
          </div>

          <div className="mt-16 grid items-center gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Video className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-wider">مكالمات فيديو</span>
              </div>
              <h3 className="text-2xl font-black">وجهاً لوجه بدقة HD</h3>
              <p className="text-muted-foreground leading-relaxed">
                مكالمات فيديو بجودة 720p مع نافذة معاينة ذاتية، تبديل بين الكاميرا الأمامية والخلفية، وإطفاء الكاميرا أثناء المكالمة دون قطع الصوت.
              </p>
              <ul className="space-y-2.5 text-sm">
                <Feat icon={CheckCircle2}>دقة عالية وأداء سلس حتى على شبكات 4G</Feat>
                <Feat icon={CheckCircle2}>تبديل سريع بين الكاميرا الأمامية والخلفية</Feat>
                <Feat icon={CheckCircle2}>إطفاء الكاميرا والاستمرار بالصوت فقط</Feat>
                <Feat icon={CheckCircle2}>إعادة اتصال تلقائي عند ضعف الشبكة</Feat>
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-emerald-500/10 to-transparent blur-2xl" />
              <img
                src={siteCallVideo}
                alt="مكالمة فيديو داخل تطبيق Giant"
                width={832}
                height={1216}
                loading="lazy"
                className="mx-auto w-full max-w-sm rounded-[2rem] border border-cyan-500/20 shadow-2xl shadow-cyan-500/20"
              />
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { Icon: ShieldCheck, title: "تشفير DTLS-SRTP", desc: "اتصال مباشر مشفّر بين الأجهزة." },
              { Icon: Wifi, title: "بدون وسطاء", desc: "WebRTC نقي، أقل تأخير ممكن." },
              { Icon: Zap, title: "مجاني تماماً", desc: "بدون أي رسوم أو اشتراكات." },
            ].map((t) => (
              <div key={t.title} className="rounded-2xl border border-emerald-500/15 bg-card/60 p-5 backdrop-blur">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <t.Icon className="h-5 w-5" />
                </div>
                <h4 className="font-extrabold">{t.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
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

      {/* Final CTA — download lives here at the bottom */}
      <section id="download" className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/15 via-background to-emerald-500/10 scroll-mt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,theme(colors.primary/0.15),transparent_70%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
            <Download className="h-3.5 w-3.5" /> التحميل الرسمي
          </span>
          <h2 className="text-3xl font-black md:text-5xl">جاهز لتبدأ؟</h2>
          <p className="mt-4 max-w-lg text-muted-foreground">حمّل Giant الآن واستمتع بتجربة مجتمع كاملة على هاتفك.</p>
          <div className="mt-8 flex justify-center">
            <DownloadButton large />
          </div>
          {version && (
            <p className="mt-4 text-xs text-muted-foreground">آخر إصدار v{version}{sizeMb && ` • ${sizeMb}`} • متوافق مع Android 7+</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-xs font-black text-primary-foreground">G</div>
            <span className="font-bold text-foreground">Giant</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link to="/reviews" className="hover:text-foreground">التقييمات</Link>
            <Link to="/site/login" className="hover:text-foreground">دخول الموقع</Link>
            <Link to="/privacy" className="hover:text-foreground">سياسة الخصوصية</Link>
          </nav>
          <span>© {new Date().getFullYear()} Giant. جميع الحقوق محفوظة.</span>
        </div>
      </footer>

      {/* Custom download confirmation modal */}
      {confirmOpen && downloadUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !starting && setConfirmOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary via-emerald-500 to-success">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_60%)]" />
              <div className="relative flex h-full items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/40 backdrop-blur">
                  <Download className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
            <div className="px-6 py-6 text-center">
              <h3 className="text-xl font-black">تحميل تطبيق Giant</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                أنت على وشك تنزيل أحدث إصدار رسمي من تطبيق Giant مباشرة من خوادمنا الآمنة.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border bg-background/50 p-2.5">
                  <div className="text-[10px] font-bold text-muted-foreground">الإصدار</div>
                  <div className="mt-0.5 text-sm font-extrabold text-primary">v{version ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-2.5">
                  <div className="text-[10px] font-bold text-muted-foreground">الحجم</div>
                  <div className="mt-0.5 text-sm font-extrabold text-primary">{sizeMb || "—"}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-2.5">
                  <div className="text-[10px] font-bold text-muted-foreground">النظام</div>
                  <div className="mt-0.5 text-sm font-extrabold text-primary">Android 7+</div>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-start text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>ملف رسمي وآمن — موقّع بمفتاح المطور وخالٍ من أي تعديلات.</span>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={startDownload}
                  disabled={starting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-500 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-70"
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> جارٍ بدء التحميل…
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" /> ابدأ التحميل الآن
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => !starting && setConfirmOpen(false)}
                  className="h-11 w-full rounded-2xl border border-border bg-background text-sm font-bold text-muted-foreground transition hover:bg-accent"
                >
                  إلغاء
                </button>
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground">
                بعد التثبيت، ستصلك التحديثات تلقائياً من داخل التطبيق.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Feat({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-foreground/90">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
