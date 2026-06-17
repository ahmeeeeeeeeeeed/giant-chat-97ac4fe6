## الهدف
إضافة نظام حسابات مستقل للموقع (منفصل تمامًا عن حسابات التطبيق) + تقييم التطبيق بالنجوم والتعليقات.

## 1) حسابات الموقع المنفصلة

- جدول جديد `site_users` في قاعدة البيانات (منفصل عن `profiles` الخاص بالتطبيق):
  - `id` (uuid)، `auth_user_id` (uuid يربط `auth.users`)، `email`، `display_name`، `provider` (`google` | `email`)، `created_at`.
- استخدام Supabase Auth بالبريد + كلمة المرور + Google OAuth، لكن **بدون** أي ربط بجدول `profiles` الخاص بالتطبيق.
- حارس `site-auth` خاص بصفحات الموقع فقط — لا يمنح أي صلاحية داخل `/app`.
- صفحات الموقع الجديدة:
  - `/site/login` — تسجيل دخول (بريد/كلمة مرور + زر Google).
  - `/site/register` — إنشاء حساب موقع.
  - `/site/account` — صفحة الحساب البسيطة (تسجيل خروج).
- **حساب الموقع لا يفتح التطبيق**: `/app` يبقى يستخدم `signInWithUsername` كما هو، ولن نقبل جلسة الموقع كبديل (سنفصل الجلسات منطقيًا عبر `metadata.kind = "site"` ومنع الدخول للتطبيق إن لم يكن لديه `profile` في جدول التطبيق).

## 2) تقييم التطبيق بالنجوم والتعليقات

- جدول `app_reviews`:
  - `id`, `rating` (1..5), `comment` (نص اختياري حتى 1000 حرف), `is_anonymous` (bool), `display_name` (مشتق: البريد المختصر أو "مجهول"), `site_user_id` (nullable للسماح بمجهول كامل), `created_at`.
- صفحة `/reviews`:
  - عرض المتوسط + عدد التقييمات + توزيع النجوم.
  - قائمة التعليقات بشكل أنيق (بطاقات، نجوم ذهبية، تاريخ نسبي).
  - نموذج كتابة تقييم: 5 نجوم تفاعلية + textarea + checkbox "نشر باسم البريد" / "نشر بمجهول".
  - يتطلب تسجيل دخول للموقع للنشر (يوجّه إلى `/site/login`).
- زر "تقييم التطبيق" داخل التطبيق (في `/app/settings` أو ما يقابلها) يفتح `https://giant-chat.lovable.app/reviews` في المتصفح الخارجي.

## 3) الأمان
- RLS على `site_users` و`app_reviews`:
  - قراءة التقييمات عامة (`anon` + `authenticated`).
  - الإدراج: `authenticated` فقط، و`site_user_id = auth.uid()`.
  - التعديل/الحذف: المالك فقط.
- GRANTs كاملة على الجدولين الجديدين.

## 4) ملفات التعديل
- ترحيل قاعدة بيانات جديد (`site_users` + `app_reviews` + RLS + GRANTs).
- `supabase--configure_social_auth` لتفعيل Google.
- إنشاء: `src/routes/site/login.tsx`، `src/routes/site/register.tsx`، `src/routes/site/account.tsx`، `src/routes/reviews.tsx`، `src/lib/site-auth.tsx`.
- تعديل `src/routes/index.tsx` لإضافة روابط (دخول الموقع + التقييمات).
- تعديل صفحة الإعدادات في التطبيق لإضافة زر "قيّم التطبيق" يفتح الموقع.

## تفاصيل تقنية
- استخدام `lovable.auth.signInWithOAuth("google", …)` لـ Google.
- تخزين `kind: "site"` ضمن `user_metadata` عند إنشاء حساب الموقع.
- مزوّد React Context منفصل `SiteAuthProvider` يُستخدم فقط في مسارات `/site/*` و`/reviews` — لا يُلف على `/app`.
