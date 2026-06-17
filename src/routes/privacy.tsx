import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — Giant" },
      {
        name: "description",
        content:
          "سياسة خصوصية تطبيق Giant: ما البيانات التي نجمعها، كيف نستخدمها، وحقوقك كمستخدم.",
      },
      { property: "og:title", content: "سياسة الخصوصية — Giant" },
      {
        property: "og:description",
        content: "كيف يتعامل تطبيق Giant مع بياناتك الشخصية.",
      },
      { property: "og:url", content: "https://giant-chat.lovable.app/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://giant-chat.lovable.app/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const updated = "17 يونيو 2026";
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <nav className="mb-6 text-sm">
          <Link to="/" className="text-primary hover:underline">
            ← العودة للرئيسية
          </Link>
        </nav>

        <header className="mb-8 border-b border-border pb-6">
          <h1 className="text-3xl font-bold mb-2">سياسة الخصوصية</h1>
          <p className="text-muted-foreground text-sm">
            تطبيق <strong>Giant</strong> — آخر تحديث: {updated}
          </p>
        </header>

        <article className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. مقدمة</h2>
            <p>
              نحن في تطبيق Giant نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
              توضح هذه السياسة أنواع البيانات التي نجمعها وكيفية استخدامها
              وحمايتها عند استخدامك للتطبيق.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. البيانات التي نجمعها</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>
                <strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، وصورة
                الملف الشخصي عند التسجيل.
              </li>
              <li>
                <strong>محتوى المستخدم:</strong> الرسائل والمحادثات التي ترسلها
                داخل التطبيق.
              </li>
              <li>
                <strong>بيانات تقنية:</strong> نوع الجهاز، إصدار نظام التشغيل،
                ومعرّف الجهاز لأغراض التحديث والدعم الفني.
              </li>
              <li>
                <strong>بيانات الاستخدام:</strong> سجلات تشغيل التطبيق لتحسين
                الأداء وحل الأخطاء.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. كيف نستخدم بياناتك</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>تشغيل خدمات التطبيق الأساسية (المحادثات، الملف الشخصي).</li>
              <li>إرسال إشعارات التحديثات الجديدة.</li>
              <li>تحسين تجربة المستخدم وحل المشاكل التقنية.</li>
              <li>الالتزام بالمتطلبات القانونية عند الحاجة.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. مشاركة البيانات</h2>
            <p>
              نحن <strong>لا نبيع</strong> بياناتك الشخصية لأي طرف ثالث. قد
              نشارك بيانات محدودة فقط مع مزوّدي خدمات موثوقين (مثل خدمات
              الاستضافة والبنية التحتية) لتشغيل التطبيق، وضمن اتفاقيات سرية
              ملزمة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. تخزين البيانات وحمايتها</h2>
            <p>
              تُخزَّن بياناتك على خوادم آمنة باستخدام بروتوكولات تشفير حديثة
              (HTTPS/TLS). نطبق إجراءات تقنية وإدارية لحمايتها من الوصول غير
              المصرح به أو التعديل أو الإفصاح.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. صلاحيات التطبيق</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>
                <strong>الإنترنت:</strong> ضروري لعمل التطبيق والاتصال بالخادم.
              </li>
              <li>
                <strong>تثبيت التحديثات:</strong> لتنزيل وتثبيت التحديثات
                الجديدة للتطبيق.
              </li>
              <li>
                <strong>التخزين:</strong> لحفظ ملفات التحديث مؤقتاً على جهازك.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. حقوقك</h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>الوصول إلى بياناتك ومراجعتها.</li>
              <li>طلب تصحيح أو تحديث بياناتك.</li>
              <li>طلب حذف حسابك وبياناتك بشكل دائم.</li>
              <li>سحب موافقتك على معالجة البيانات في أي وقت.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. خصوصية الأطفال</h2>
            <p>
              التطبيق غير موجّه للأطفال دون 13 عاماً، ولا نجمع بيانات منهم عن
              قصد. إذا علمت أن طفلاً قدّم بيانات، يرجى التواصل معنا لحذفها.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. تغييرات على السياسة</h2>
            <p>
              قد نُحدّث هذه السياسة من وقت لآخر. سيتم إشعارك بأي تغييرات جوهرية
              عبر التطبيق، ويُعتبر استمرار استخدامك للتطبيق موافقة على السياسة
              المُحدّثة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. التواصل معنا</h2>
            <p>
              لأي استفسار حول هذه السياسة أو لممارسة حقوقك، تواصل معنا عبر
              البريد الإلكتروني:{" "}
              <a
                href="mailto:support@giant-chat.lovable.app"
                className="text-primary hover:underline"
              >
                support@giant-chat.lovable.app
              </a>
            </p>
          </section>
        </article>

        <footer className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} Giant. جميع الحقوق محفوظة.
        </footer>
      </div>
    </div>
  );
}
