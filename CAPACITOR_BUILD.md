# 📱 بناء تطبيق Giant كـ APK أصلي عبر Capacitor

تم تجهيز المشروع لبناء APK يحتوي الفيديو والصور محفوظة محليًا داخل التطبيق.

---

## ✅ ما تم تجهيزه تلقائيًا

- ✓ تحميل الفيديو (`public/media/welcome-video.mp4` - 6.5 ميجا) محليًا
- ✓ تحميل صورة الخلفية (`public/media/welcome-poster.jpg`) محليًا
- ✓ تثبيت `@capacitor/core` و `@capacitor/cli` و `@capacitor/android`
- ✓ إنشاء `capacitor.config.ts`
- ✓ تعديل الكود ليقرأ الفيديو من المسار المحلي `/media/welcome-video.mp4`

---

## 🛠️ ما تحتاج تنفيذه على جهازك (مرة واحدة)

### المتطلبات
- **Node.js 20+** و **Java JDK 21** و **Android Studio** (يثبّت Android SDK تلقائيًا)
- اضبط متغير البيئة `ANDROID_HOME` (Android Studio يفعل ذلك تلقائيًا)

### الخطوات
```bash
# 1) نزّل المشروع من GitHub المربوط بـ Lovable
git clone <your-repo-url>
cd <your-repo>

# 2) ثبّت الحزم
npm install     # أو bun install

# 3) ابنِ نسخة الويب الثابتة
npm run build

# 4) أضف منصة Android (مرة واحدة فقط)
npx cap add android

# 5) انسخ ملفات الويب (بما فيها الفيديو) إلى مشروع Android
npx cap sync android

# 6) افتح Android Studio
npx cap open android
```

داخل Android Studio:
- اختر **Build → Generate Signed Bundle / APK → APK → Release**
- اتبع المعالج لإنشاء مفتاح توقيع (keystore) واحفظه في مكان آمن
- سيُنتج ملف `app-release.apk` في `android/app/build/outputs/apk/release/`

---

## 🎯 أين يُحفظ الفيديو داخل APK؟

بعد `npx cap sync android` ستجد الفيديو في:
```
android/app/src/main/assets/public/media/welcome-video.mp4
```
يُحمَّل من الذاكرة المحلية فورًا — لا إنترنت، لا انتظار. ✨

---

## ⚠️ ملاحظات مهمة

### 1. SSR لا يعمل داخل APK
التطبيق الحالي يستخدم **TanStack Start مع Server Functions** التي تعمل على Cloudflare Workers. داخل APK، يعمل الكود الذي يستدعي Supabase مباشرة من المتصفح (مثل تسجيل الدخول، الغرف، الدردشة) بشكل سليم لأنه يتصل بـ Supabase عبر HTTPS.

أي ميزة تعتمد على `createServerFn` ستحتاج إلى استضافتها على الـ URL المنشور `https://giant-chat.lovable.app` ثم استدعاؤها من APK كـ API خارجي.

### 2. التحديثات
بعد أي تعديل تريد تضمينه في APK جديد:
```bash
npm run build && npx cap sync android
```
ثم أعد البناء من Android Studio.

### 3. تحديث الإصدار
في `android/app/build.gradle` ارفع `versionCode` و `versionName` قبل كل إصدار جديد على Play Store.

---

## 📦 نشر على Google Play Store

1. أنشئ حساب مطوّر ($25 دفعة واحدة) في [Google Play Console](https://play.google.com/console)
2. ابنِ **AAB** بدلاً من APK (Android App Bundle): `Build → Generate Signed Bundle → AAB`
3. ارفع الملف في Play Console واملأ بيانات المتجر

---

أي مشكلة في البناء؟ راجع توثيق Capacitor الرسمي: https://capacitorjs.com/docs/android
