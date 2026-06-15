import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Updates the user's `profiles.last_seen_at` every ~25s while the tab is
// foregrounded, and immediately on visibility/focus/blur/unload events.
// This keeps "آخر ظهور" (last seen) live and accurate.
export function usePresenceHeartbeat(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (stopped) return;
      try {
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", userId);
      } catch {
        // network hiccup — ignore
      }
    };

    const start = () => {
      ping();
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (document.visibilityState === "visible") ping();
      }, 25_000);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else ping();
    };

    const onPageHide = () => {
      // Best-effort final ping on close/background
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
        const key = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
        const token = (supabase as any).auth?.currentSession?.access_token;
        if (key) {
          const headers = new Blob([JSON.stringify({ last_seen_at: new Date().toISOString() })], { type: "application/json" });
          // sendBeacon can't set custom headers — fall back to fetch keepalive
          void fetch(url, {
            method: "PATCH",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${token ?? key}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
          }).catch(() => {});
          void headers;
        } else {
          void ping();
        }
      } catch {
        void ping();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", start);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", start);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [userId]);
}
