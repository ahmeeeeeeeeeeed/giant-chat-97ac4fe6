# بناء تطبيق Android (APK) لـ Giant

تم تجهيز المشروع بالكامل لبناء APK باستخدام Capacitor. تنفيذ بناء APK يتطلب جهازك المحلي مع Android Studio (لا يمكن تنفيذه داخل Lovable).

## ما تم إعداده داخل المشروع

- تثبيت `@capacitor/core` و `@capacitor/cli` و `@capacitor/android` و `SplashScreen` و `StatusBar`.
- ملف `capacitor.config.ts` يربط التطبيق بـ `https://giant-chat.lovable.app`.
- Service Worker وOffline Cache وIndexedBD ومُحمِّل البيانات الخلفي يعملون داخل WebView تلقائيًا.

## خطوات البناء على جهازك

> المتطلبات: Node.js 20+، Android Studio، JDK 17.

1. صدِّر المشروع إلى GitHub من Lovable (زر GitHub → Connect/Export).
2. استنسخ المشروع وثبّت الاعتماديات:
   ```bash
   git clone <your-repo-url>
   cd <project>
   npm install
   ```
3. ابنِ نسخة الويب (يولّد مجلد `dist`):
   ```bash
   npm run build
   ```
4. أضف منصة Android (مرة واحدة فقط):
   ```bash
   npx cap add android
   ```
5. زامِن الإعدادات والملفات إلى المشروع الأصلي:
   ```bash
   npx cap sync android
   ```
6. افتح المشروع في Android Studio:
   ```bash
   npx cap open android
   ```
7. داخل Android Studio:
   - استبدل أيقونة التطبيق من **Right-click `res` → New → Image Asset** (أيقونة 1024×1024).
   - شاشة البداية: أبدل `android/app/src/main/res/drawable/splash.png` بصورتك.
   - عدّل `android/app/build.gradle` → `versionCode` و `versionName` قبل النشر.
   - من **Build → Generate Signed Bundle / APK** لإصدار APK أو AAB موقّع.

## تحديث التطبيق لاحقًا

كل تغيير على الويب يظهر فورًا في APK لأن التطبيق يحمّل من الرابط المنشور. لا حاجة لإعادة بناء APK إلا عند تغيير:
- الأيقونة أو اسم التطبيق أو إعدادات Android.
- ترقية Capacitor أو إضافة Plugin جديد.

عند التحديث: شغّل `npm run build` ثم `npx cap sync android` ثم Rebuild من Android Studio.

## ملاحظات

- التطبيق يحتاج اتصال إنترنت عند أول تشغيل لتخزين الواجهة والبيانات الأساسية، ثم يعمل بدون إنترنت بفضل Service Worker وIndexedDB.
- الإشعارات الفورية (Push) تحتاج إعداد FCM وحزمة `@capacitor/push-notifications` — أبلغني إن أردت إضافتها.
- تسجيل دخول Google يعمل عبر OAuth داخل WebView طالما أن الـ redirect URL مضاف في إعدادات Supabase Auth.
