import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  MessageCircle, Users, Music, Sparkles, Trophy, Gift, Heart, Bell,
  Phone, Video, ArrowRight, CheckCircle2,
} from "lucide-react";
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

type Feature = {
  slug: string;
  title: string;
  tagline: string;
  Icon: React.ComponentType<{ className?: string }>;
  img: string;
  intro: string;
  tasks: { title: string; desc: string }[];
};

const FEATURES: Record<string, Feature> = {
  chat: {
    slug: "chat",
    title: "محادثات فورية",
    tagline: "دردشات خاصة وجماعية لحظية",
    Icon: MessageCircle, img: siteChat,
    intro: "نظام محادثات متكامل يجعل التواصل مع أصدقائك ومجتمعك أسرع وأكثر متعة بصور وفيديو ورسائل صوتية وإشعارات لحظية.",
    tasks: [
      { title: "دردشات خاصة 1‑إلى‑1", desc: "ابدأ محادثة فورية مع أي صديق بزر واحد، مع مؤشرات الكتابة وحالة القراءة." },
      { title: "محادثات جماعية", desc: "أنشئ مجموعات بأعضاء متعددين، أدرها وأضف أو احذف الأعضاء بسهولة." },
      { title: "وسائط متعددة", desc: "أرسل صوراً، فيديوهات، ملفات، وملصقات بجودة عالية." },
      { title: "رسائل صوتية", desc: "اضغط واتحدث — رسائل صوتية واضحة بضغطة واحدة." },
      { title: "تجاهل وحظر", desc: "تحكم كامل بمن يمكنه مراسلتك مع أدوات تجاهل وحظر سريعة." },
    ],
  },
  rooms: {
    slug: "rooms",
    title: "غرف صوتية حية",
    tagline: "ادخل أو أنشئ غرفاً صوتية بكل سهولة",
    Icon: Users, img: siteRooms,
    intro: "غرف صوتية متعددة المتحدثين بجودة عالية، عامة أو خاصة، مع أدوات إدارة احترافية لأصحاب الغرف.",
    tasks: [
      { title: "إنشاء غرفة خاصة بك", desc: "أنشئ غرفتك بتصميم وخلفية مخصصة وأدرها كمالك." },
      { title: "إدارة المتحدثين", desc: "ارفع الأعضاء للمنصة، اكتم، أو أزل بسرعة." },
      { title: "غرف عامة وخاصة", desc: "غرف عامة للجميع، أو خاصة بالدعوة فقط لأعضائك المختارين." },
      { title: "قائمة الأعضاء", desc: "تابع المتواجدين، افتح دردشة معهم أو أضفهم كأصدقاء." },
      { title: "أدوار وصلاحيات", desc: "عيّن مشرفين بصلاحيات محددة لإدارة الغرفة." },
    ],
  },
  music: {
    slug: "music",
    title: "موسيقى مشتركة",
    tagline: "شغّل الأغاني مع أصدقائك بمزامنة لحظية",
    Icon: Music, img: siteMusic,
    intro: "استمع للموسيقى مع أصدقائك داخل الغرف الصوتية بمزامنة كاملة ومؤثرات بصرية تفاعلية.",
    tasks: [
      { title: "تشغيل مشترك", desc: "اختر أغنية وشغّلها للجميع في الغرفة في نفس اللحظة." },
      { title: "قائمة تشغيل", desc: "أنشئ قوائم تشغيل خاصة بك أو شاركها مع الغرفة." },
      { title: "مؤثرات بصرية", desc: "موجات صوتية متحركة وألوان تفاعلية أثناء التشغيل." },
      { title: "تحكم بالصوت", desc: "اضبط مستوى الموسيقى بمعزل عن صوت المتحدثين." },
    ],
  },
  profile: {
    slug: "profile",
    title: "ملف شخصي وإنجازات",
    tagline: "اصنع هويتك الرقمية بتفاصيل احترافية",
    Icon: Trophy, img: siteProfile,
    intro: "ملف شخصي متكامل بشارات، إطارات، ومؤثرات، يعكس مستواك ونشاطك داخل التطبيق.",
    tasks: [
      { title: "صورة وغلاف مخصصان", desc: "ارفع صورتك وغلافك واجعل ملفك مميزاً." },
      { title: "شارات الإنجاز", desc: "اكسب شارات تظهر بجوار اسمك في كل مكان." },
      { title: "إطارات احترافية", desc: "اختر إطاراً مميزاً يحيط بصورتك الشخصية." },
      { title: "مؤثرات الملف", desc: "أضف مؤثرات بصرية متحركة على ملفك الشخصي." },
      { title: "المستوى والنقاط", desc: "ارتقِ بمستواك يومياً من خلال نشاطك." },
    ],
  },
  games: {
    slug: "games",
    title: "ألعاب ومسابقات",
    tagline: "تسلَّ ونافس وفز بجوائز يومية",
    Icon: Sparkles, img: siteGames,
    intro: "مجموعة ألعاب مدمجة داخل التطبيق مع لوحات شرف وجوائز للمتفوقين.",
    tasks: [
      { title: "ألعاب فردية ومتعددة", desc: "ألعاب متنوعة تناسب الجميع." },
      { title: "لوحات الشرف", desc: "تنافس على أعلى المراكز يومياً وأسبوعياً." },
      { title: "جوائز يومية", desc: "اربح هدايا وعملات بمجرد المشاركة." },
      { title: "تحديات الأصدقاء", desc: "تحدَّ صديقك في مباراة مباشرة." },
    ],
  },
  store: {
    slug: "store",
    title: "متجر الهدايا الفاخر",
    tagline: "هدايا متحركة احترافية وعروض حصرية",
    Icon: Gift, img: siteStore,
    intro: "متجر هدايا متكامل بتصاميم متحركة فاخرة، أرسلها لأصدقائك أو داخل الغرف الصوتية.",
    tasks: [
      { title: "تصفّح الهدايا", desc: "مئات الهدايا بتصاميم متحركة احترافية." },
      { title: "إرسال هدية", desc: "أرسل هدية بضغطة لصديق أو لمتحدث في الغرفة." },
      { title: "عناصر مميزة", desc: "إطارات، تأثيرات دخول، وعناصر VIP حصرية." },
      { title: "عروض دورية", desc: "خصومات وعروض محدودة المدة بشكل دوري." },
    ],
  },
  community: {
    slug: "community",
    title: "مجتمع نابض",
    tagline: "منشورات، قصص، وتفاعل يومي",
    Icon: Heart, img: siteCommunity,
    intro: "شارك لحظاتك، تابع أصدقاءك، وتفاعل مع مجتمع كامل من المستخدمين النشطين.",
    tasks: [
      { title: "نشر المنشورات", desc: "شارك صوراً، نصوصاً، أو فيديوهات مع متابعيك." },
      { title: "قصص يومية", desc: "قصص تختفي بعد 24 ساعة لمشاركة لحظاتك السريعة." },
      { title: "تعليقات وردود فعل", desc: "تفاعل مع منشورات أصدقائك بإعجابات وتعليقات." },
      { title: "متابعة الأصدقاء", desc: "تابع من تحب وشاهد منشوراتهم في صفحتك الرئيسية." },
    ],
  },
  notifications: {
    slug: "notifications",
    title: "إشعارات ذكية",
    tagline: "كل التنبيهات في مكان واحد منظم",
    Icon: Bell, img: siteNotifications,
    intro: "نظام إشعارات ذكي يجمع كل التنبيهات المهمة بترتيب منطقي وتحكم كامل.",
    tasks: [
      { title: "إشعارات الرسائل", desc: "تنبيهات فورية لكل رسالة جديدة." },
      { title: "طلبات الصداقة", desc: "تابع طلبات الصداقة الواردة واقبلها بضغطة." },
      { title: "تفاعلات المنشورات", desc: "اعرف من أعجب بمنشورك أو علّق عليه." },
      { title: "تحكم بالتنبيهات", desc: "فعّل أو عطّل أي نوع إشعار حسب رغبتك." },
    ],
  },
  "audio-call": {
    slug: "audio-call",
    title: "مكالمات صوتية",
    tagline: "صوت نقي بدون تشويش — مجاناً",
    Icon: Phone, img: siteCallAudio,
    intro: "مكالمات صوتية احترافية مبنية على WebRTC بدقة عالية وزمن استجابة منخفض، مجانية تماماً.",
    tasks: [
      { title: "اتصال فوري", desc: "اتصل من داخل المحادثة الخاصة بضغطة واحدة." },
      { title: "حذف الضوضاء", desc: "تقنيات إلغاء الضوضاء والصدى لمكالمة واضحة." },
      { title: "كتم وسماعة", desc: "تحكم سريع بالميكروفون والسماعة الخارجية." },
      { title: "سجل المكالمات", desc: "كل مكالماتك: واردة، صادرة، وفائتة." },
    ],
  },
  "video-call": {
    slug: "video-call",
    title: "مكالمات فيديو",
    tagline: "وجهاً لوجه بدقة HD",
    Icon: Video, img: siteCallVideo,
    intro: "مكالمات فيديو بجودة 720p مع أداء سلس حتى على شبكات 4G.",
    tasks: [
      { title: "جودة HD", desc: "دقة 720p بصورة واضحة وأداء سلس." },
      { title: "تبديل الكاميرا", desc: "بدّل بين الكاميرا الأمامية والخلفية بضغطة." },
      { title: "إطفاء الكاميرا", desc: "أوقف الفيديو واستمر بالصوت بدون قطع المكالمة." },
      { title: "إعادة اتصال ذكية", desc: "إعادة اتصال تلقائي عند ضعف الشبكة." },
    ],
  },
};

export const Route = createFileRoute("/features/$slug")({
  loader: ({ params }) => {
    const f = FEATURES[params.slug];
    if (!f) throw notFound();
    return { feature: f };
  },
  head: ({ loaderData }) => {
    const f = loaderData?.feature;
    const title = f ? `${f.title} — Giant` : "Giant";
    const desc = f?.intro ?? "";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: f?.img },
      ],
    };
  },
  component: FeaturePage,
  notFoundComponent: () => (
    <main className="flex min-h-dvh items-center justify-center bg-background text-foreground" dir="rtl">
      <div className="text-center">
        <h1 className="text-2xl font-black">الميزة غير موجودة</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">العودة للرئيسية</Link>
      </div>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main className="flex min-h-dvh items-center justify-center bg-background text-foreground p-6" dir="rtl">
      <div className="text-center">
        <h1 className="text-xl font-bold">حدث خطأ</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">إعادة المحاولة</button>
      </div>
    </main>
  ),
});

function FeaturePage() {
  const { feature: f } = Route.useLoaderData();
  const Icon = f.Icon;
  const others = Object.values(FEATURES).filter(x => x.slug !== f.slug).slice(0, 4);

  return (
    <main className="min-h-dvh bg-background text-foreground" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-lg font-black text-primary-foreground shadow-lg shadow-primary/30">G</div>
            <span className="text-lg font-extrabold tracking-tight">Giant</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold transition hover:bg-accent">
            <ArrowRight className="h-4 w-4 rotate-180" /> الرئيسية
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <Icon className="h-8 w-8" />
            </div>
            <h1 className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-4xl font-black leading-tight text-transparent md:text-6xl">
              {f.title}
            </h1>
            <p className="mt-3 text-lg font-medium text-primary">{f.tagline}</p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{f.intro}</p>
          </div>
          <div className="relative mx-auto w-full max-w-xs">
            <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/30 to-transparent blur-2xl" />
            <img src={f.img} alt={f.title} className="w-full rounded-[2rem] border border-border/60 shadow-2xl shadow-primary/20" />
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-10 text-center">
            <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">ماذا يقدم لك هذا الزر؟</span>
            <h2 className="text-2xl font-black md:text-3xl">المهام التي يقوم بها</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {f.tasks.map((t, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold">{t.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h3 className="mb-6 text-center text-xl font-black">مميزات أخرى قد تعجبك</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map(o => {
              const OIcon = o.Icon;
              return (
                <Link key={o.slug} to="/features/$slug" params={{ slug: o.slug }} className="group rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <OIcon className="h-5 w-5" />
                  </div>
                  <div className="font-bold">{o.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{o.tagline}</div>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link to="/" hash="download" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-500 px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
              العودة لتحميل التطبيق <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
