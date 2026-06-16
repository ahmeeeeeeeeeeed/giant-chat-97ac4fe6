# 📱 Giant — APK Build (Automated)

تطبيق Giant مُجهَّز ببناء APK تلقائي عبر **GitHub Actions**. لا تحتاج Android Studio ولا أي إعداد محلي.

---

## 🚀 كيف تحصل على ملف APK جاهز للتثبيت

### الخطوة 1 — اربط المشروع بـ GitHub (مرة واحدة)
من Lovable: زر **+** أعلى الشات → **GitHub** → **Connect project**.
سيُنشئ مستودعًا تلقائيًا ويرفع كل الكود (بما فيه مجلد `android/` و workflow البناء).

### الخطوة 2 — انتظر اكتمال البناء
بعد أول push يبدأ GitHub Actions تلقائيًا:
1. افتح مستودعك على GitHub.
2. اذهب إلى تبويب **Actions**.
3. ستجد Workflow باسم **Build Android APK** يعمل (يستغرق ~5-8 دقائق).

### الخطوة 3 — حمّل ملف APK
بعد نجاح البناء:

**أ) من Releases** (الأسهل):
- اذهب إلى **Releases** في صفحة المستودع.
- ستجد إصدار جديد باسم `Giant APK build #N`.
- اضغط على `app-release.apk` وحمّله مباشرة على هاتفك.

**ب) من Artifacts**:
- ادخل Actions → اختر آخر تشغيل ناجح → اسحب لأسفل → **Artifacts** → `Giant-release-apk`.

### الخطوة 4 — ثبّت على هاتفك
- افتح الملف على هاتف Android.
- أذِن "تثبيت من مصادر مجهولة" إذا طُلب.
- سيظهر تطبيق **Giant** في القائمة بأيقونته الجديدة.

---

## 🎬 ماذا داخل APK؟

- ✅ شِفرة التطبيق كاملة (SPA من TanStack Start مبنية بوضع `CAPACITOR_BUILD=1`).
- ✅ **الفيديو 6.5 ميجا** مُضمَّن في `android/app/src/main/assets/public/media/welcome-video.mp4`.
- ✅ صورة الخلفية وكل الأيقونات.
- ✅ يفتح فورًا بدون انتظار تحميل الفيديو من الإنترنت.

اتصال الإنترنت يُستخدم فقط لـ:
- تسجيل الدخول والمحادثات (Supabase).
- الصور والملفات التي يرفعها المستخدمون.

---

## ⚙️ تخصيص البناء

### تعديل اسم/معرّف التطبيق
في `capacitor.config.ts`:
```ts
appId: "app.lovable.giant",  // غيّر إلى معرّفك (مثل com.yourcompany.giant)
appName: "Giant",
```

### استبدال أيقونة التطبيق
ضع أيقوناتك في:
```
android/app/src/main/res/mipmap-*/ic_launcher.png
```
أو استخدم: `npx @capacitor/assets generate` بعد وضع `assets/icon.png` (1024x1024).

### للنشر على Google Play Store
1. ولّد keystore حقيقيًا:
   ```bash
   keytool -genkey -v -keystore giant-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias giant
   ```
2. ارفعه كـ **GitHub Secret** باسم `RELEASE_KEYSTORE_BASE64` (`base64 giant-release.jks`).
3. أضف Secrets أخرى: `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`.
4. عدّل `.github/workflows/build-apk.yml` ليستخدم هذه السرّيات بدل debug keystore، وأنشئ **AAB** بدل APK:
   ```yaml
   - run: cd android && ./gradlew bundleRelease
   ```

---

## 🔄 تحديث التطبيق

كل `git push` إلى `main` يُنتج إصدار APK جديد تلقائيًا. لتحديث المستخدمين، أرسل لهم رابط الـ Release الجديد.

> ملاحظة: تحديث Play Store اللاحق يستلزم رفع `versionCode` في `android/app/build.gradle` قبل البناء.

---

## ⚠️ ملاحظات تقنية

- يُبنى التطبيق في وضع **SPA** (لا SSR) داخل APK — جميع استعلامات Supabase تعمل مباشرة من العميل بنفس طريقة الويب.
- إذا كان عندك `createServerFn` تعتمد على بيئة Cloudflare Workers، استدعها كـ API عبر `https://giant-chat.lovable.app/...` بدل تضمينها في APK.
- للاختبار محليًا (اختياري): `npm install && CAPACITOR_BUILD=1 npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`.

---

❓ مشكلة في البناء؟ افتح Actions → الـ run الفاشل → اقرأ السجل، أو شاركني نصّ الخطأ.
