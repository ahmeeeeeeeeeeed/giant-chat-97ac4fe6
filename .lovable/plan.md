# خطة تحويل التطبيق إلى Offline-First

## 1) تخزين المحادثات الخاصة محليًا فقط

**التخزين:** استخدام SQLite عبر `@capacitor-community/sqlite` على Android، مع fallback إلى IndexedDB (عبر `idb-keyval` الموجودة بالفعل) على الويب.

**جدول محلي `dm_messages`:**
- `id` (UUID), `owner_user_id`, `peer_user_id`, `sender_id`, `content`, `media_url`, `created_at`, `read_at`, `pending` (0/1)
- فهرس على `(owner_user_id, peer_user_id, created_at)`
- **عزل المستخدمين:** كل صف مرتبط بـ `owner_user_id` (المستخدم الحالي على الجهاز) لضمان أن المستخدم الجديد لا يرى رسائل من سبقه.

**التغييرات على السيرفر:**
- جدولة Cron يومي يحذف من `direct_messages` كل ما عمره > 24 ساعة (نافذة تسليم فقط لمن لم يكن متصلًا). الرسائل المسلَّمة محليًا تُؤكَّد وتُحذف من السيرفر فورًا.
- بمجرد استلام الجهاز للرسالة عبر Realtime/Polling وحفظها محليًا → يستدعي serverFn لحذفها من `direct_messages`.

**النتيجة:** المحادثات الخاصة لا تبقى على السحابة، حذف التطبيق = ضياع كل المحادثات الخاصة.

## 2) الغرف والرسائل العامة

تبقى كما هي على السيرفر (لا تغيير في `room_messages`).

## 3) جلسة المستخدم وOffline Auth

- Supabase بالفعل يحفظ الجلسة في `localStorage` ويجدّدها تلقائيًا. سنضيف:
  - على Android: نسخ `access_token` و `refresh_token` إلى `@capacitor/preferences` (مخزن آمن للنظام) ليبقى محفوظًا حتى لو مسح المتصفح بياناته.
  - عند إقلاع التطبيق بدون إنترنت: نقرأ الجلسة المحلية ونسمح بالدخول مباشرة دون انتظار `getUser()`.
- **لا يتم حفظ كلمة المرور إطلاقًا** — فقط `refresh_token`.
- عند تسجيل الخروج: مسح Preferences + localStorage + قاعدة SQLite الخاصة بالمستخدم.

## 4) PWA / Offline Shell

تفعيل `vite-plugin-pwa` مع service worker:
- `NetworkFirst` للـ HTML
- `CacheFirst` للأصول المبنية (JS/CSS/خطوط/صور)
- تجاوز Lovable preview (حسب skill/pwa)
- صفحة `offline.tsx` الموجودة تُستخدم كـ navigation fallback عند فشل الشبكة وعدم وجود كاش.

## 5) قراءات Offline للبيانات المشتركة

استخدام `offline-cache.ts` الموجود (IndexedDB) كـ read-through cache لـ:
- الملف الشخصي، الإعدادات، قائمة الأصدقاء، آخر رسائل الغرف، قائمة المحادثات.
عند الـ offline: نعرض البيانات المخزنة + شارة "وضع عدم الاتصال".

## 6) المزامنة عند عودة الاتصال

- `offline-queue.ts` الموجود يُحدَّث للكتابة في SQLite بدلًا من إرسال DM للسيرفر (DM = محلي بحت بين الطرفين عبر Realtime payload فقط).
- عند عودة الإنترنت: إرسال الرسائل المعلَّقة، تحديث الكاش، إعادة الاشتراك في Realtime.

## 7) شارة وضع عدم الاتصال

تعديل `OnlineStatusBanner.tsx`: بدلًا من شاشة تحميل كاملة عند انقطاع الإنترنت، عرض شريط علوي صغير "وضع عدم الاتصال" والسماح للمستخدم بالتنقل والاطلاع.

---

## القسم التقني (للمطورين)

### حزم جديدة
- `@capacitor-community/sqlite` + `@capacitor/preferences`
- `vite-plugin-pwa` (لو غير مفعّل)

### ملفات جديدة
- `src/lib/local-db.ts` — طبقة SQLite/IndexedDB موحَّدة
- `src/lib/dm-store.ts` — CRUD للمحادثات الخاصة محليًا
- `src/lib/session-store.ts` — حفظ/استرجاع التوكنات عبر Preferences
- `src/lib/dm-sync.ts` — اشتراك Realtime + استدعاء serverFn `ack_dm_delivered`
- `src/lib/ack-dm.functions.ts` — serverFn يحذف الرسالة من `direct_messages` بعد تأكيد التسليم

### ملفات تُعدَّل
- `src/routes/app/chats.$id.tsx` — قراءة/كتابة من المتجر المحلي بدل `direct_messages`
- `src/routes/app/chats.index.tsx` — قائمة المحادثات من المتجر المحلي
- `src/components/OnlineStatusBanner.tsx` — شارة بدل شاشة تحميل
- `src/lib/auth.tsx` — استرجاع الجلسة من Preferences على Android، مسحها عند تسجيل الخروج
- `src/lib/offline-queue.ts` — توجيه DM إلى المتجر المحلي
- `vite.config.ts` — إضافة `vite-plugin-pwa` مع الحراسة المطلوبة
- `src/lib/register-sw.ts` — تسجيل SW مع كل قيود skill/pwa

### Migration
- Cron يومي على `direct_messages` لحذف ما عمره > 24h.
- RPC `ack_dm_delivered(message_id uuid)` تحذف الرسالة إذا كان المستدعي هو المستلم.

---

## ⚠️ تنبيه مهم

هذا تغيير معماري كبير يلامس: المصادقة، التخزين، Realtime، PWA، وكل صفحات المحادثات الخاصة. سيتطلب عدة جولات متتالية للتنفيذ والاختبار، وستكون هناك فترة انتقالية قد تختفي فيها المحادثات الخاصة القديمة من السيرفر (لأن المنطق الجديد سيعتبرها للحذف بعد التسليم).

**هل أبدأ بالتنفيذ كاملًا، أم نبدأ بمرحلة ١ (تخزين المحادثات الخاصة محليًا + حذفها من السيرفر بعد التسليم) ثم ننتقل للباقي؟**
