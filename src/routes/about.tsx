import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, Video, MessageCircle, Users, Shield, Globe } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "عن تطبيق Giant — تطبيق المكالمات والدردشة المجاني" },
      { name: "description", content: "تعرف على Giant: تطبيق عربي للمكالمات الصوتية والفيديو المجانية، الدردشة، الغرف الصوتية، الألعاب والمكافآت. تواصل مع العائلة والأصدقاء حول العالم." },
      { name: "keywords", content: "عن Giant, تطبيق Giant, من نحن, تطبيق مكالمات عربي, دردشة عربية" },
      { property: "og:title", content: "عن تطبيق Giant" },
      { property: "og:description", content: "تطبيق عربي متكامل للمكالمات المجانية والدردشة والغرف الصوتية." },
      { property: "og:url", content: "https://giant-chat.lovable.app/about" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://giant-chat.lovable.app/about" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "عن Giant",
        url: "https://giant-chat.lovable.app/about",
        inLanguage: "ar",
      }),
    }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          عن تطبيق Giant
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          Giant هو تطبيق متكامل للتواصل الاجتماعي، صُمم خصيصاً ليجمعك بمن تحب بأسهل وأسرع وأكثر الطرق متعة. نوفر لك مكالمات صوتية وفيديو مجانية بجودة عالية، دردشات فورية، غرف صوتية حية، ألعاب وتحديات يومية، ومكافآت مميزة.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {[
            { Icon: Phone, title: "مكالمات مجانية", desc: "اتصل بمن تحب بدون أي رسوم." },
            { Icon: Video, title: "فيديو HD مستقر", desc: "جودة عالية حتى مع الإنترنت الضعيف." },
            { Icon: MessageCircle, title: "دردشة آمنة", desc: "محادثات خاصة وجماعية محمية." },
            { Icon: Users, title: "غرف صوتية حية", desc: "أنشئ غرفك وتحدث مع المجتمع." },
            { Icon: Shield, title: "خصوصيتك أولاً", desc: "تحكم كامل بمن يصلك ويراك." },
            { Icon: Globe, title: "مجتمع عالمي", desc: "تواصل مع أصدقاء من كل مكان." },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl border border-border bg-card">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-4">رسالتنا</h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          نؤمن بأن التواصل حق للجميع. لذلك نقدم Giant مجاناً تماماً، بواجهة عربية بسيطة وميزات قوية تجعل تجربتك في المكالمات والدردشة استثنائية، سواء كنت تتحدث مع عائلتك، أصدقائك، أو تتعرف على أشخاص جدد من حول العالم.
        </p>

        <div className="flex gap-3 flex-wrap">
          <Link to="/features" className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium">
            استكشف المميزات
          </Link>
          <Link to="/privacy" className="px-6 py-3 rounded-full border border-border font-medium">
            سياسة الخصوصية
          </Link>
        </div>
      </div>
    </div>
  );
}
