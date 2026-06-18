import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageCircle, Users, Music, Trophy, Gift, Heart, Bell,
  Phone, Video, Sparkles, ArrowLeft,
} from "lucide-react";

const FEATURES = [
  { slug: "audio-call", title: "مكالمات صوتية مجانية", desc: "اتصل بأصدقائك وعائلتك بجودة عالية ومجاناً تماماً.", Icon: Phone },
  { slug: "video-call", title: "مكالمات فيديو HD", desc: "مكالمات فيديو مستقرة وواضحة في أي وقت ومن أي مكان.", Icon: Video },
  { slug: "chat", title: "محادثات فورية", desc: "دردشات خاصة وجماعية مع صور وفيديو ورسائل صوتية.", Icon: MessageCircle },
  { slug: "rooms", title: "غرف صوتية حية", desc: "ادخل أو أنشئ غرفاً صوتية عامة وخاصة بسهولة.", Icon: Users },
  { slug: "music", title: "موسيقى مشتركة", desc: "شغّل الأغاني مع أصدقائك بمزامنة لحظية داخل الغرف.", Icon: Music },
  { slug: "games", title: "ألعاب وتحديات", desc: "العب وتحدّى أصدقاءك بألعاب ممتعة ومسابقات يومية.", Icon: Sparkles },
  { slug: "store", title: "متجر الهدايا", desc: "أرسل هدايا فاخرة لأصدقائك واكسب مكافآت مميزة.", Icon: Gift },
  { slug: "profile", title: "ملف شخصي وإنجازات", desc: "اصنع هويتك الرقمية بشارات وإطارات احترافية.", Icon: Trophy },
  { slug: "community", title: "مجتمع نابض", desc: "تعرّف على أصدقاء جدد من جميع أنحاء العالم.", Icon: Heart },
  { slug: "notifications", title: "إشعارات ذكية", desc: "ابقَ على اطلاع بكل ما يهمك بإشعارات لحظية.", Icon: Bell },
];

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "مميزات تطبيق Giant — مكالمات وفيديو ودردشة وغرف وألعاب" },
      { name: "description", content: "اكتشف كل مميزات تطبيق Giant: مكالمات صوتية وفيديو مجانية، دردشة فورية، غرف صوتية، ألعاب، تحديات، هدايا ومكافآت." },
      { name: "keywords", content: "مميزات Giant, تطبيق مكالمات مجانية, تطبيق فيديو, دردشة, غرف صوتية, ألعاب اون لاين, مكافآت" },
      { property: "og:title", content: "مميزات تطبيق Giant" },
      { property: "og:description", content: "كل ما يقدمه Giant: مكالمات، فيديو، دردشة، غرف، ألعاب، ومكافآت." },
      { property: "og:url", content: "https://giant-chat.lovable.app/features" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://giant-chat.lovable.app/features" }],
  }),
  component: FeaturesIndex,
});

function FeaturesIndex() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
        </Link>

        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            مميزات تطبيق Giant
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            تطبيق متكامل للاتصال والتواصل: مكالمات صوتية وفيديو مجانية، دردشة فورية، غرف صوتية، ألعاب وتحديات، ومكافآت يومية.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ slug, title, desc, Icon }) => (
            <Link
              key={slug}
              to="/features/$slug"
              params={{ slug }}
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <span className="inline-block mt-4 text-sm text-primary font-medium">اعرف المزيد ←</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
