// Cross-platform notification helpers (Capacitor on native, Web Notification API in browser).

let _idCounter = 1;

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function showLocalNotification(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  // Don't notify when the tab is visible AND user is already on that URL
  try {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && opts.url) {
      if (typeof window !== "undefined" && window.location.pathname === opts.url) return;
    }
  } catch { /* ignore */ }

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
  // Web fallback
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
