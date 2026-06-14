// Cross-platform notification helpers (Capacitor on native, Web Notification API in browser).
import { toast } from "sonner";
import { bumpBellCount } from "@/lib/bell-counter";

let _idCounter = 1;

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Elegant "system banner" style toast — auto-dismisses after 2s, includes a "حسناً" dismiss button. */
function showInAppSystemToast(opts: { title: string; body: string; url?: string }): void {
  try {
    toast.custom(
      (id) => (
        <div
          dir="rtl"
          className="pointer-events-auto w-[min(94vw,420px)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] ring-1 ring-emerald-400/20 backdrop-blur-2xl animate-in slide-in-from-top-4 fade-in duration-300"
        >
          {/* Status-bar-like top strip */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-l from-emerald-500/10 to-transparent border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 text-[9px] font-black text-emerald-950 shadow-sm">G</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/90">Giant</span>
            </div>
            <span className="text-[10px] font-medium text-white/40">الآن</span>
          </div>
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
            className="flex cursor-pointer items-start gap-3 px-3.5 py-3 transition active:bg-white/5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-white">{opts.title}</div>
              <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/75">{opts.body}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toast.dismiss(id); }}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 active:scale-95"
            >
              حسناً
            </button>
          </div>
        </div>
      ),
      { duration: 2000, position: "top-center" }
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

  // Always bump the bell counter for every incoming notification
  try { bumpBellCount(); } catch { /* ignore */ }

  const visible = typeof document !== "undefined" && document.visibilityState === "visible";

  // Always show in-app system-style banner when the tab is visible (2s)
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
