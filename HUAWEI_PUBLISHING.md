# دليل نشر تطبيق Giant على متجر هواوي (AppGallery)

## ملخص الجاهزية

| البند | الحالة |
|---|---|
| Package name (applicationId) | ✅ `app.lovable.giant` |
| Version code / name | ✅ `110600` / `11.6.0` |
| توقيع APK بمفتاح release | ✅ مُهيّأ في GitHub Actions |
| خدمات Google (GMS) | ✅ غير مستخدمة — لا حاجة لتحويل HMS |
| Firebase / FCM / Maps / Sign-In | ✅ غير مستخدمة |
| أيقونة التطبيق | ✅ Giant emerald (mipmap كاملة) |
| AndroidManifest permissions | ✅ INTERNET + REQUEST_INSTALL_PACKAGES |
| Target SDK ≥ 34 | ✅ (متطلب هواوي 2025) |

**النتيجة:** التطبيق جاهز للرفع كـ APK مباشرة بدون أي تعديلات كود.

---

## ما أحتاج منك (مرة واحدة فقط)

### 1) حساب مطور Huawei
- اذهب إلى: https://developer.huawei.com/consumer/en/console
- نوع الحساب: **Individual** ($99/سنة) أو **Enterprise** (يتطلب سجل تجاري).
- وثائق مطلوبة: صورة هوية + بطاقة ائتمان (للأفراد) أو سجل شركة (للشركات).
- مدة المراجعة: 1-3 أيام عمل.

### 2) إنشاء التطبيق في AppGallery Connect
1. My apps → New → Add app
2. املأ:
   - **App name:** Giant
   - **Package name:** `app.lovable.giant` (يجب أن يطابق `applicationId`)
   - **Default language:** العربية
   - **App category:** اختر التصنيف المناسب
   - **Device:** Mobile phone

### 3) الأصول المطلوبة للرفع (Store Listing)

| الأصل | المواصفات |
|---|---|
| أيقونة التطبيق | 512×512 PNG (متوفرة: `public/icons/icon-512x512.png`) |
| لقطات شاشة | 3-8 صور بدقة 1080×1920 على الأقل (يجب التقاطها يدوياً) |
| صورة غلاف | 1280×720 (اختياري لكن مُستحسن) |
| اسم التطبيق | عربي + إنجليزي (≤ 64 حرف) |
| وصف قصير | ≤ 80 حرف |
| وصف كامل | ≤ 8000 حرف |
| رابط سياسة الخصوصية | ضروري — استخدم: `https://giant-chat.lovable.app/privacy` |
| رقم التواصل | بريد + هاتف |
| التصنيف العمري | استبيان داخل AppGallery |

---

## خطوات الرفع

### الخطوة 1: تنزيل APK الموقّع
- من GitHub Actions → آخر build ناجح → نزّل `app-release.apk`.

### الخطوة 2: رفع الـ APK
1. AppGallery Connect → تطبيقك → **Distribute** → **Software Versions**.
2. **Software package** → Upload → اختر `app-release.apk`.
3. هواوي ستفحص التوقيع وتحدّث versionCode تلقائياً.

### الخطوة 3: ملء بيانات الإصدار
- **Update description:** ما الجديد في الإصدار (عربي).
- **App information:** الوصف، الأيقونة، اللقطات.
- **Compliance:** أجب على استبيان المحتوى والإعلانات.
- **App release country/region:** اختر الدول المستهدفة.

### الخطوة 4: المراجعة والنشر
- اضغط **Submit for review**.
- مدة المراجعة: 1-2 يوم عمل عادةً.
- بعد القبول: التطبيق يظهر على المتجر خلال ساعات.

---

## التحديثات اللاحقة
لكل إصدار جديد:
1. ارفع `versionCode` في `package.json` و `android/app/build.gradle`.
2. شغّل GitHub Actions ليبني APK جديد موقّع بنفس المفتاح.
3. ارفعه في AppGallery → Software Versions → New software package.
4. **مهم:** استخدم نفس keystore دائماً، وإلا سيرفض هواوي التحديث.

---

## هل يمكنني (Lovable) النشر مباشرة؟

**لا.** متاجر التطبيقات (Google Play، Huawei AppGallery، Apple App Store، Samsung Galaxy Store، Amazon Appstore) جميعها تتطلب:
- حساب مطور مدفوع باسمك القانوني.
- توقيع تعهد المطور والامتثال لسياسات المتجر.
- رفع يدوي عبر لوحة التحكم الخاصة بالمتجر.

دوري ينتهي عند تجهيز APK موقّع + كل الأصول والوثائق. الرفع النهائي يجب أن تقوم به أنت من حسابك.

### المتاجر المتوافقة مع APK الحالي بدون تعديل
- ✅ **Huawei AppGallery**
- ✅ **Samsung Galaxy Store**
- ✅ **Amazon Appstore**
- ✅ **Xiaomi GetApps**
- ⚠️ **Google Play** — يقبل APK لكن يفضّل AAB (Android App Bundle). يمكنني تجهيز AAB لو طلبت.
- ❌ **Apple App Store** — يتطلب بناء iOS منفصل وحساب Apple Developer ($99/سنة) + جهاز Mac للتوقيع.
