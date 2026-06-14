import { useState } from "react";
import { Bell, Camera, Mic, Image as ImageIcon, MapPin, Loader2, ShieldCheck, Check } from "lucide-react";
import {
  ensureNotificationPermission,
  ensureCameraPermission,
  ensureMicPermission,
  ensureMediaLibraryPermission,
} from "@/lib/app-permissions";
import { toast } from "sonner";

export const PERMISSIONS_GATE_KEY = "giant.permissions.granted.v1";

export function hasCompletedPermissionsGate(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PERMISSIONS_GATE_KEY) === "1";
}

type PermKey = "notifications" | "camera" | "mic" | "media" | "location";

const ITEMS: { key: PermKey; Icon: typeof Bell; title: string; desc: string }[] = [
  { key: "notifications", Icon: Bell, title: "الإشعارات", desc: "لتصلك الرسائل والتنبيهات فور وصولها" },
  { key: "camera", Icon: Camera, title: "الكاميرا", desc: "لالتقاط الصور وتغيير صورة الملف الشخصي" },
  { key: "mic", Icon: Mic, title: "المايكروفون", desc: "لإرسال الرسائل الصوتية والمكالمات" },
  { key: "media", Icon: ImageIcon, title: "الصور والملفات", desc: "لاختيار الصور من معرضك ومشاركتها" },
  { key: "location", Icon: MapPin, title: "الموقع (اختياري)", desc: "لإظهار خدمات قريبة منك" },
];

export default function PermissionsGate({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState<Record<PermKey, boolean>>({
    notifications: false, camera: false, mic: false, media: false, location: false,
  });

  const requestAll = async () => {
    setLoading(true);
    const next = { ...granted };
    try {
      next.notifications = await ensureNotificationPermission().catch(() => false);
      next.camera = await ensureCameraPermission().catch(() => false);
      next.media = await ensureMediaLibraryPermission().catch(() => false);
      next.mic = await ensureMicPermission().catch(() => false);
      // Location: best-effort via browser API (Capacitor plugin optional)
      try {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => { next.location = true; resolve(); },
              () => { next.location = false; resolve(); },
              { timeout: 8000 }
            );
          });
        }
      } catch { /* ignore */ }
      setGranted(next);

      const essentialOk = next.notifications || next.camera || next.media || next.mic;
      if (!essentialOk) {
        toast.error("يجب الموافقة على صلاحية واحدة على الأقل للمتابعة");
        return;
      }
      localStorage.setItem(PERMISSIONS_GATE_KEY, "1");
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="fixed inset-0 z-[100] flex flex-col bg-background px-6 py-8 text-foreground overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mt-4 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-lg">
            <ShieldCheck className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="mt-5 text-2xl font-black">صلاحيات التطبيق</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            للاستفادة الكاملة من Giant، نحتاج لبعض الأذونات. اضغط "موافقة على الكل" للمتابعة لتسجيل الدخول.
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {ITEMS.map(({ key, Icon, title, desc }) => (
            <li key={key} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{title}</span>
                  {granted[key] && <Check className="h-4 w-4 text-success" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={loading}
          onClick={requestAll}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "موافقة على الكل والمتابعة"}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
          يمكنك تعديل الأذونات لاحقاً من إعدادات نظام التشغيل في أي وقت.
        </p>
      </div>
    </main>
  );
}
