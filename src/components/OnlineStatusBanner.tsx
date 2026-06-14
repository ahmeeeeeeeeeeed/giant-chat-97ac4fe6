import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { flushQueue, getQueue, onQueueChange, type QueuedMessage } from "@/lib/offline-queue";

/**
 * Offline-first connectivity indicator.
 *
 * Behavior:
 * - Offline: small top banner "وضع عدم الاتصال" — does NOT block navigation
 *   so the user keeps browsing cached pages and local data.
 * - Online + queued items being sent: brief top sync pill.
 */
export function OnlineStatusBanner() {
  const online = useOnline();
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const q = await getQueue();
      if (!cancelled) setQueue(q);
    };
    refresh();
    const off = onQueueChange(refresh);
    return () => { cancelled = true; off(); };
  }, []);

  useEffect(() => {
    if (online) {
      setSyncing(true);
      flushQueue().finally(() => setSyncing(false));
    }
  }, [online]);

  if (!online) {
    return (
      <div
        className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-amber-600/95 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.375rem)" }}
        role="status"
        aria-live="polite"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span>وضع عدم الاتصال — تتصفح بياناتك المحفوظة محليًا</span>
      </div>
    );
  }

  if (syncing && queue.length > 0) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>جاري المزامنة...</span>
      </div>
    );
  }

  return null;
}
