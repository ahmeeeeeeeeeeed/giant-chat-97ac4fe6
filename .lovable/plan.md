# خطة: نظام الحسابات الافتراضية (AI Personas)

نظام لإنشاء وإدارة حسابات افتراضية يديرها النظام لزيادة التفاعل والمحتوى، مع شفافية كاملة عبر شارة "AI" واضحة.

## 1. قاعدة البيانات (migration)

### جداول جديدة
- **ai_personas**: الشخصيات الافتراضية
  - `profile_id` (FK → profiles, unique) — كل شخصية مربوطة ببروفايل حقيقي معلَّم
  - `display_name`, `bio`, `avatar_url`, `persona_type` (friendly/news/gamer/...)
  - `is_active` (bool), `post_interval_minutes` (default 180), `reaction_rate` (0-1)
  - `last_post_at`, `last_react_at`
- **ai_persona_templates**: قوالب المحتوى
  - `persona_type`, `kind` (post/story/comment/reply)
  - `content` (نص)، `media_url` (اختياري)، `weight` (للترشيح العشوائي)
- **ai_persona_activity_log**: سجل الإجراءات (للمراقبة ومنع التكرار)
  - `persona_id`, `action` (post/like/comment/story/react_story), `target_id`, `created_at`

### تعديل `profiles`
- إضافة عمود `is_ai` (bool, default false) — لعرض شارة "AI" في كل واجهة تظهر فيها البروفايل.

### RLS
- قراءة `ai_personas` و`profiles.is_ai`: للجميع (لإظهار الشارة).
- كتابة وإدارة الجداول: admin فقط عبر `has_role`.
- `ai_persona_templates` و`activity_log`: admin only.

## 2. الواجهة الإدارية

ملف جديد: `src/routes/app/admin.ai-personas.tsx` (مرتبط في `admin.index.tsx`).

يتيح:
- إنشاء شخصية جديدة (يولّد user وهمي في `profiles` + سجل في `ai_personas`).
- تعديل: الاسم، الصورة، Bio، نوع الشخصية، الفاصل الزمني، معدل التفاعل، تفعيل/إيقاف.
- إدارة قوالب المحتوى (إضافة/حذف/تعديل).
- عرض سجل النشاط الأخير.
- زر "تشغيل دورة الآن" لاختبار يدوي.

## 3. محرك التشغيل (Server Functions + Cron)

ملف: `src/lib/ai-personas.functions.ts`

- `runPersonaCycle()` — server function محمية بـ admin، تستدعى من:
  1. زر يدوي في صفحة الإدارة.
  2. cron job كل 15 دقيقة عبر `pg_net` → `/api/public/hooks/ai-personas-tick`.

### منطق الدورة (لكل شخصية active)
- إذا `now - last_post_at >= post_interval_minutes`: ينشر منشور/قصة عشوائية من القوالب → `community_posts` أو `stories`.
- بنسبة `reaction_rate`: يختار منشورات/قصص حديثة من آخر 24 ساعة ويضيف:
  - إعجاب (`community_reactions`)
  - تعليق قصير من قوالب `kind=comment`
  - تفاعل قصة (`story_reactions`)
- حدود صارمة: مثلاً ≤ 3 إعجابات و≤ 1 تعليق لكل شخصية في الدورة، لمنع الإزعاج.
- تسجيل كل إجراء في `ai_persona_activity_log`.

### Route عام للـ cron
`src/routes/api/public/hooks/ai-personas-tick.ts` — يستدعي `runPersonaCycle` بمفتاح آمن (apikey header).

## 4. الشفافية البصرية (Badge)

مكوّن: `src/components/AiBadge.tsx` — شارة صغيرة "AI" بلون مميز (أزرق/سماوي) مع أيقونة Bot.

يُعرض بجانب اسم المستخدم في:
- `profile.$id.tsx` و`my_profile.tsx`
- بطاقات منشورات `community.tsx`
- قائمة الدردشات (إن وُجد بوت يتحدث)
- بطاقات القصص `StoriesBar.tsx` / `StoryViewer.tsx`
- نتائج البحث/قائمة الأصدقاء

التحقق عبر `profile.is_ai === true`.

## 5. منع إساءة الاستخدام

- لا يمكن لمستخدم حقيقي إرسال طلب صداقة/رسالة خاصة لحسابات AI (تحقق في `friend_request` و`send_dm`)، أو نسمح بذلك لكن بدون رد — قابل للنقاش لاحقاً. **الافتراضي: السماح بالمشاهدة فقط، لا رسائل خاصة.**
- لا تُحسب حسابات AI ضمن إحصائيات المستخدمين النشطين.

## 6. مصدر المحتوى

- قوالب جاهزة يدخلها الأدمن (الأبسط، يبدأ هنا).
- لاحقاً (مرحلة 2 — ليست ضمن هذه الخطة): توليد محتوى تلقائي عبر Lovable AI Gateway باستخدام `google/gemini-3-flash-preview` لإنتاج منشورات وتعليقات سياقية.

## التفاصيل التقنية المختصرة

```
migration:
  + profiles.is_ai
  + ai_personas, ai_persona_templates, ai_persona_activity_log
  + RLS + GRANTs
  + cron job (pg_cron) كل 15 دقيقة

new files:
  src/components/AiBadge.tsx
  src/lib/ai-personas.functions.ts
  src/routes/app/admin.ai-personas.tsx
  src/routes/api/public/hooks/ai-personas-tick.ts

edited files:
  src/routes/app/admin.index.tsx       (رابط للوحة Personas)
  src/routes/app/profile.$id.tsx        (شارة AI)
  src/routes/app/my_profile.tsx         (شارة AI)
  src/routes/app/community.tsx          (شارة AI على المنشورات)
  src/components/StoriesBar.tsx         (شارة AI)
```

## أسئلة قبل التنفيذ

1. **التعليقات والإعجابات**: هل تريد أن تعلّق وتعجب حسابات AI على منشورات المستخدمين الحقيقيين؟ (الخطة تقول نعم بحدود.)
2. **الرسائل الخاصة**: هل تسمح للمستخدم بمراسلة حساب AI؟ (الافتراضي: لا.)
3. **توليد المحتوى**: نبدأ بالقوالب فقط، ونضيف توليد AI لاحقاً — موافق؟

