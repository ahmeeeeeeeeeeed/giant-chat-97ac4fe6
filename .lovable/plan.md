سأنفذ الطلبات الأربعة بالترتيب:

## 1) إصلاح مشكلة "التحديث لا يختفي بعد تثبيته"

السبب الجذري: نص الـ CI (`bump-version.mjs`) يُزيد رقم الإصدار في `package.json` أثناء البناء لكنه لا يُرجعه إلى Git، وكل بناء جديد يبدأ من `1.0.0`. عندما يكتب المسؤول "1.0.2" يدويًا، الإصدار المخبوز داخل APK قد يكون رقمًا آخر (مثلاً `1.0.1`)، فيظل `UpdateGate` يظن أن هناك إصدارًا أحدث.

الحل (طبقتان لضمان عدم تكرار المشكلة):

أ) **علامة "تم التثبيت" محلية في `UpdateGate.tsx`**: عند بدء التنزيل من المستخدم، نحفظ:
```
localStorage.setItem("giant.update.installed.v", latest.version)
localStorage.setItem("giant.update.installed.code", latest.version_code)
```
وعند التحقق التالي: إذا كان `installed.code >= latest.version_code` → نخفي البانر، حتى لو كان `APP_VERSION` المخبوز قديمًا.

ب) **استبدال نص الـ bump ليستخدم `GITHUB_RUN_NUMBER`** (`scripts/bump-version.mjs`): بدل الزيادة من قيمة محلية، اجعل `patch = GITHUB_RUN_NUMBER` فيصبح كل APK له رقم فريد ومتزايد بشكل قابل للتوقع، ويعرضه المسؤول في صفحة الإدارة (`APP_VERSION` معروض هناك) لينسخه حرفيًا.

## 2) نقل زر "الانضمام للغرفة" خارج الغرفة

إضافة شاشة preview/lobby في `src/routes/app/rooms.$id.tsx`: إذا `myRank === null` (غير عضو) → نعرض بطاقة الغرفة (الاسم/الوصف/عدد الأعضاء) وزر "انضمام للغرفة" فقط — بدون قائمة الرسائل ولا حقل الإدخال. لا يدخل المستخدم فعليًا إلا بعد الضغط ونجاح `room_join`.

## 3) مغادرة تلقائية عند فقد الاتصال/الخروج

في نفس صفحة الغرفة:
- اشتراك على `useOnline()` — عند `false` → استدعاء `supabase.from("room_members").delete()` (إن أمكن) + تصفير `myRank` + `navigate({ to: "/app" })`.
- اشتراك على `onAuthStateChange` — عند `SIGNED_OUT` → نفس السلوك.
- ملف `src/routes/app.tsx` يستمع لتغير المصادقة عالميًا ويُخرج من أي غرفة مفتوحة.
- لا rejoin تلقائي: عند عودة الاتصال يظل المستخدم في شاشة الانضمام (نقطة 2) ويجب الضغط يدويًا.

## 4) التحقق الفعلي من التخزين المحلي للمحادثات الخاصة (DMs)

`src/routes/app/chats.$id.tsx` يستخدم `cacheGet/cacheSet` على `cacheKeys.dmMessages(...)`. سأتحقق ميدانيًا من:
- أن `loadMessages` يقرأ من الكاش أولًا قبل Supabase.
- أن كل insert/update/delete واقعي ينعكس على الكاش (وليس فقط الحالة).
- أن قائمة المحادثات (`chats.index.tsx`) أيضًا تُخزَّن.
- في حالة عدم وجود `useEffect` يكتب للكاش عند تغير `messages`، أضيفه (مماثل لما تم في الغرف).

التقرير النهائي سيوضح ما كان يعمل/ما تم إصلاحه/القيود المتبقية.

## الملفات المتأثرة
- `src/components/UpdateGate.tsx` (إصلاح 1أ)
- `scripts/bump-version.mjs` (إصلاح 1ب)
- `src/routes/app/rooms.$id.tsx` (المهام 2 و 3)
- `src/routes/app.tsx` (المهمة 3 — مستمع عالمي)
- `src/routes/app/chats.$id.tsx` + `chats.index.tsx` (المهمة 4)

هل أبدأ التنفيذ بهذه الخطة؟
