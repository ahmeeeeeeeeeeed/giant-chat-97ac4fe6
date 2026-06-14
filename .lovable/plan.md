# خطة Offline-First — الخيار (ب) المعتمد

## ✅ المرحلة 1 — التخزين المحلي للمحادثات الخاصة
- مزامنة فورية لكاش IndexedDB عند كل تغيير (إرسال/استقبال realtime/حذف).
- دمج آمن يحافظ على الرسائل المعلَّقة `q_*`.
- عزل لكل مستخدم عبر مفاتيح كاش تتضمن `user.id`.
- لا حذف من `direct_messages` على الإطلاق.

## ✅ المرحلة 2 — PWA Offline Shell
- `vite-plugin-pwa` مفعَّل بالكامل في `vite.config.ts`:
  - `NetworkFirst` لكل تنقّل صفحات → كل صفحة يزورها المستخدم تُكاش وتفتح offline.
  - `CacheFirst` للـ JS/CSS/الخطوط/الصور/الفيديو.
  - `navigateFallback: /offline` كاحتياط.
- `register-sw.ts` محصَّن (لا يسجّل في dev/iframe/Lovable preview، يدعم `?sw=off`).
- `src/routes/offline.tsx` بصفحة ودودة مع إعادة محاولة وفتح المحادثات المحفوظة.

## ✅ المرحلة 3 — حفظ الجلسة محليًا
- `@capacitor/preferences` لنسخ `access_token` و`refresh_token` في تخزين Android الآمن.
- `src/lib/session-store.ts`:
  - `backupSession()` عند كل تغيير في حالة المصادقة.
  - `restoreSessionFromBackup()` عند الإقلاع — يُعيد الجلسة لـ Supabase إذا فُقدت من WebView.
  - `clearSessionBackup()` عند تسجيل الخروج.
- لا تُحفظ كلمة المرور نهائيًا — فقط التوكنات.
- على الويب: no-op (Supabase يحفظ في localStorage تلقائيًا).

## النتيجة المتحققة
- فتح التطبيق بدون إنترنت → كل صفحة سبقت زيارتها تُعرض من الكاش.
- المحادثات المحفوظة محليًا متاحة فورًا.
- المستخدم يبقى مسجّل الدخول بعد إغلاق التطبيق وإعادة فتحه.
- المزامنة مع Supabase تستأنف تلقائيًا عند عودة الاتصال.
- لا حذف لأي بيانات سحابية.
