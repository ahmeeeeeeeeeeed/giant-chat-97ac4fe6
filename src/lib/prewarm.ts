// Background prewarm: after first online launch, silently fetch the main
// app routes so the service worker caches them for later offline use.
// Runs once per install, never blocks the UI.

const PREWARM_KEY = "giant:prewarmed:v2";

const ROUTES_TO_PREWARM = [
  "/",
  "/login",
  "/register",
  "/offline",
  "/app",
  "/app/friends",
  "/app/chats",
  "/app/community",
  "/app/games",
  "/app/store",
  "/app/notifications",
  "/app/settings",
  "/app/account",
  "/app/my_profile",
  "/app/create-room",
];

// Large media that must be available offline. The welcome video plays on the
// landing page (`/`) and should keep working inside the APK without network.
const MEDIA_TO_PREWARM = [
  "/__l5e/assets-v1/03139ba5-10e0-4dcc-b177-50976f81e15e/welcome-bg.mp4",
];

function canPrewarm(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!navigator.onLine) return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  if (!import.meta.env.PROD) return false;
  try {
    if (localStorage.getItem(PREWARM_KEY)) return false;
  } catch {
    /* ignore */
  }
  return true;
}

async function prefetch(url: string): Promise<void> {
  try {
    await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      cache: "no-cache",
    });
  } catch {
    /* offline / abort — ignore */
  }
}

export function schedulePrewarm(): void {
  if (!canPrewarm()) return;

  const run = async () => {
    // Wait until the SW is ready so responses get cached by runtime caching.
    try {
      await navigator.serviceWorker.ready;
    } catch {
      return;
    }
    // Throttle: 2 concurrent prefetches, sequential pacing.
    const queue = [...ROUTES_TO_PREWARM];
    const workers = Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!url) break;
        await prefetch(url);
      }
    });
    await Promise.all(workers);
    // Prefetch large media (welcome video) so it plays offline inside the APK.
    for (const url of MEDIA_TO_PREWARM) {
      try {
        await fetch(url, { credentials: "same-origin", cache: "no-cache" });
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(PREWARM_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const idle = (cb: () => void) => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(cb, { timeout: 4000 });
    } else {
      setTimeout(cb, 2500);
    }
  };

  idle(() => {
    void run();
  });
}
