## نظام المكالمات الصوتية والفيديو (WebRTC + Supabase Realtime)

سأبني نظام مكالمات حقيقي داخل Giant Chat باستخدام WebRTC peer-to-peer مع Supabase Realtime كـ Signaling Server (مجاني بالكامل، بدون Agora/Twilio).

### 1. قاعدة البيانات (migration واحدة)

**جدول `calls`** — سجل المكالمات والـ signaling:
- `caller_id`, `callee_id`, `call_type` ('audio' | 'video')
- `status` ('ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'busy')
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`
- `end_reason` ('hangup' | 'rejected' | 'missed' | 'failed')

**جدول `call_signals`** — تبادل SDP/ICE بين الطرفين عبر Realtime:
- `call_id`, `from_user`, `to_user`, `signal_type` ('offer'|'answer'|'ice'|'hangup'|'ringing'), `payload` (jsonb)

- RLS صارمة: المستخدم يرى فقط مكالماته (caller أو callee).
- تفعيل Realtime على الجدولين.
- GRANT للأدوار المطلوبة.

### 2. STUN/TURN (مجاني)

- STUN: خوادم Google المجانية (`stun:stun.l.google.com:19302` + احتياطية).
- TURN: استخدام **Open Relay Project** المجاني (`openrelay.metered.ca`) كـ fallback للشبكات المقيدة — صفر تكلفة. يمكن للمستخدم لاحقاً استبداله بـ coturn ذاتي الاستضافة عبر متغير بيئة `VITE_TURN_URL/USERNAME/CREDENTIAL`.

### 3. الواجهة

**في `src/routes/app/chats.$id.tsx`** (أعلى المحادثة):
- زر اتصال صوتي 📞 + زر اتصال فيديو 🎥 بتصميم أنيق دائري بجانب اسم المستخدم.

**شاشة المكالمة `src/components/CallScreen.tsx`** (Dialog ملء الشاشة بأسلوب Telegram):
- خلفية متدرجة داكنة + صورة المستخدم الكبيرة + الاسم + حالة الاتصال (يرن/متصل/...).
- مؤقت مدة المكالمة.
- فيديو محلي صغير (PiP) + فيديو الطرف الآخر بملء الشاشة (لمكالمات الفيديو).
- أزرار: كتم مايك، تشغيل/إيقاف كاميرا، تبديل أمامية/خلفية، مكبر صوت، إنهاء (أحمر دائري كبير).
- شاشة مكالمة واردة منفصلة: قبول (أخضر) / رفض (أحمر) + رنين صوتي + اهتزاز.

**مزود عام `CallProvider`** يُركّب في `__root.tsx`:
- يستمع لإشارات `call_signals` عبر Realtime على مستوى التطبيق كله.
- يعرض شاشة المكالمة الواردة من أي صفحة.
- يدير حالة WebRTC PeerConnection.

### 4. منطق WebRTC (`src/lib/webrtc/`)

- `call-manager.ts`: إنشاء/إدارة RTCPeerConnection، تبادل SDP/ICE عبر Supabase channel، معالجة إعادة الاتصال (ICE restart عند الانقطاع).
- جودة تكيفية: قيود فيديو 1280×720 افتراضياً مع `degradationPreference: 'maintain-framerate'`.
- معالجة الصوت: `echoCancellation`, `noiseSuppression`, `autoGainControl`.
- نغمات: ملف رنين قصير + نغمة اتصال (تولّد عبر Web Audio API لتجنب assets جديدة).

### 5. سجل المكالمات

- صفحة `src/routes/app/calls.tsx`: قائمة جميع المكالمات (واردة/صادرة/فائتة) بأيقونات ملوّنة، اضغط لإعادة الاتصال.
- شارة المكالمات الفائتة في التبويب السفلي.

### 6. صلاحيات + Capacitor

- توسيع `src/lib/app-permissions.ts` لطلب الميك+الكاميرا قبل بدء/قبول المكالمة.
- إضافة `RECORD_AUDIO`, `CAMERA`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT` في `AndroidManifest.xml` (عبر سكربت patch موجود).
- WebView يدعم WebRTC افتراضياً على Android 5+.

### 7. الأمان

- RLS تمنع أي مستخدم من رؤية signals لا تخصه.
- المكالمات end-to-end عبر DTLS-SRTP (مدمج بـ WebRTC).
- لا يمر الصوت/الفيديو بسيرفرنا — فقط الـ signaling.

### ملفات سيتم إنشاؤها/تعديلها
- migration جديدة (calls + call_signals + RLS + realtime).
- `src/lib/webrtc/call-manager.ts`, `src/lib/webrtc/ice-servers.ts`, `src/lib/webrtc/ringtones.ts`
- `src/lib/use-calls.tsx` (CallProvider + hooks)
- `src/components/CallScreen.tsx`, `src/components/IncomingCallDialog.tsx`
- `src/routes/app/calls.tsx` (سجل)
- تعديل `src/routes/app/chats.$id.tsx` (الزرّان)
- تعديل `src/routes/__root.tsx` (تركيب CallProvider)
- تعديل `src/lib/app-permissions.ts`
- تعديل `scripts/patch-android-permissions.mjs`

### ملاحظات تشغيلية
- TURN المجاني (Open Relay) كافٍ للاستخدام الخفيف والاختبار؛ للإنتاج الكثيف يُنصح بإعداد coturn على VPS لاحقاً (السكربت سيقرأ من `VITE_TURN_*` تلقائياً عند توفرها).
- لا توجد أي رسوم خدمات خارجية.

هل أبدأ التنفيذ؟
