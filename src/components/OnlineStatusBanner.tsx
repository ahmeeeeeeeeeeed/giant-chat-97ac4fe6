import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { flushQueue, getQueue, onQueueChange, type QueuedMessage } from "@/lib/offline-queue";

/**
 * System-style connectivity overlay.
 * When offline: show a subtle full-screen "loading" indicator (no offline
 * page, no buttons, no links) until the connection returns.
 * When syncing queued messages after reconnect: brief top status pill.
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm">جاري التحميل...</span>
        </div>
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
