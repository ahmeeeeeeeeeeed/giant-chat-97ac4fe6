import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام — تطبيق Giant" },
      { name: "description", content: "شروط استخدام تطبيق Giant للمكالمات والدردشة. اقرأ الشروط والأحكام قبل استخدام التطبيق." },
      { property: "og:title", content: "شروط الاستخدام — Giant" },
      { property: "og:description", content: "شروط وأحكام استخدام تطبيق Giant." },
      { property: "og:url", content: "https://giant-chat.lovable.app/terms" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://giant-chat.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const sections = [
    { title: "1. القبول بالشروط", body: "باستخدامك تطبيق Giant فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي منها، يرجى عدم استخدام التطبيق." },
    { title: "2. الاستخدام المسموح", body: "يحق لك استخدام التطبيق للأغراض الشخصية والقانونية فقط. يُمنع استخدام التطبيق لأي نشاط ينتهك القوانين أو حقوق الآخرين." },
    { title: "3. المحتوى والسلوك", body: "أنت مسؤول عن أي محتوى تنشره أو تشاركه. يُمنع نشر المحتوى المسيء، العنيف، الإباحي، أو الذي يحرض على الكراهية. نحتفظ بحق إزالة أي محتوى ينتهك هذه الشروط." },
    { title: "4. الحساب والأمان", body: "أنت مسؤول عن الحفاظ على سرية بيانات حسابك. أي نشاط يتم من خلال حسابك يعتبر تحت مسؤوليتك." },
    { title: "5. الخصوصية", body: "نحترم خصوصيتك. يرجى مراجعة سياسة الخصوصية لمعرفة كيفية تعاملنا مع بياناتك." },
    { title: "6. الملكية الفكرية", body: "جميع حقوق التطبيق وتصميمه ومحتواه محفوظة لـ Giant. لا يجوز نسخ أو إعادة استخدام أي جزء بدون إذن." },
    { title: "7. إيقاف الحساب", body: "نحتفظ بحق إيقاف أو حذف أي حساب ينتهك هذه الشروط دون إشعار مسبق." },
    { title: "8. التعديلات", body: "قد نقوم بتحديث هذه الشروط من وقت لآخر. استمرارك في استخدام التطبيق بعد التحديث يعني موافقتك على الشروط الجديدة." },
    { title: "9. التواصل", body: "لأي استفسار حول الشروط، يمكنك التواصل معنا عبر صفحة التطبيق الرسمية." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
        </Link>

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          شروط الاستخدام
        </h1>
        <p className="text-sm text-muted-foreground mb-10">آخر تحديث: 2026</p>

        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title} className="p-6 rounded-2xl border border-border bg-card">
              <h2 className="text-xl font-semibold mb-2">{s.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
