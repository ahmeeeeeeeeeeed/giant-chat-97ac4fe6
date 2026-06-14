// Cross-platform notification helpers (Capacitor on native, Web Notification API in browser).
import { toast } from "sonner";

let _idCounter = 1;

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Professional in-app "system message" style toast that auto-dismisses after 1s. */
function showInAppSystemToast(opts: { title: string; body: string; url?: string }): void {
  try {
    toast.custom(
      (id) => (
        <div
          onClick={() => {
            try {
              if (opts.url && typeof window !== "undefined") {
                window.history.pushState({}, "", opts.url);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            } catch { /* ignore */ }
            toast.dismiss(id);
          }}
          className="pointer-events-auto flex w-[min(92vw,380px)] items-start gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-900/95 via-emerald-800/95 to-emerald-900/95 px-3.5 py-2.5 text-white shadow-[0_18px_40px_-12px_rgba(6,78,59,0.7)] ring-1 ring-white/10 backdrop-blur-xl cursor-pointer active:scale-[0.98] transition"
          dir="rtl"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-emerald-900 shadow-lg shadow-amber-900/30 ring-2 ring-white/30 text-[15px]">
            🔔
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/90">النظام</span>
              <span className="h-1 w-1 rounded-full bg-emerald-300/70" />
              <span className="truncate text-[13px] font-bold text-white">{opts.title}</span>
            </div>
            <div className="mt-0.5 truncate text-[12.5px] leading-snug text-emerald-50/90">{opts.body}</div>
          </div>
        </div>
      ),
      { duration: 1000, position: "top-center" }
    );
  } catch { /* ignore */ }
}

export async function showLocalNotification(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  // Skip entirely if user is already on that exact URL
  try {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && opts.url) {
      if (typeof window !== "undefined" && window.location.pathname === opts.url) return;
    }
  } catch { /* ignore */ }

  const visible = typeof document !== "undefined" && document.visibilityState === "visible";

  // Always show in-app system-style toast when the tab is visible (1s, then disappears)
  if (visible) {
    showInAppSystemToast({ title: opts.title, body: opts.body, url: opts.url });
    return;
  }

  if (await isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [
          {
            id: _idCounter++ % 2_000_000_000,
            title: opts.title,
            body: opts.body,
            extra: { url: opts.url ?? "/app/notifications" },
          },
        ],
      });
      return;
    } catch { /* fall through */ }
  }
  // Web fallback (tab hidden)
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(opts.title, { body: opts.body, tag: opts.tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
    n.onclick = () => {
      try { window.focus(); } catch { /* ignore */ }
      if (opts.url) {
        try { window.location.assign(opts.url); } catch { /* ignore */ }
      }
      n.close();
    };
  } catch { /* ignore */ }
}

// ===== Room "seen" bookkeeping (localStorage) =====
const ROOM_SEEN_PREFIX = "giant:roomSeen:";
export function markRoomSeen(roomId: string): void {
  try { localStorage.setItem(ROOM_SEEN_PREFIX + roomId, new Date().toISOString()); } catch { /* ignore */ }
}
export function getRoomLastSeen(roomId: string): string {
  try {
    const v = localStorage.getItem(ROOM_SEEN_PREFIX + roomId);
    if (v) return v;
    // First time we see this room on this device: treat everything before now as already seen
    const nowIso = new Date().toISOString();
    try { localStorage.setItem(ROOM_SEEN_PREFIX + roomId, nowIso); } catch { /* ignore */ }
    return nowIso;
  } catch { /* ignore */ }
  return new Date().toISOString();
}

// Native tap → route mapping
let _tapHandlerInstalled = false;
export async function installNativeNotificationTapHandler(navigateTo: (url: string) => void): Promise<void> {
  if (_tapHandlerInstalled) return;
  _tapHandlerInstalled = true;
  if (!(await isNative())) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const url = (action.notification?.extra as any)?.url;
      if (typeof url === "string") navigateTo(url);
    });
  } catch { /* ignore */ }
}
