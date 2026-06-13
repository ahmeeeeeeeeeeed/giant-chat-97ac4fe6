import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { flushQueue, getQueue, onQueueChange, type QueuedMessage } from "@/lib/offline-queue";

export function OnlineStatusBanner() {
  const online = useOnline();
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [justBackOnline, setJustBackOnline] = useState(false);

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
      setJustBackOnline(true);
      setSyncing(true);
      flushQueue().finally(() => {
        setSyncing(false);
        const t = setTimeout(() => setJustBackOnline(false), 2200);
        return () => clearTimeout(t);
      });
    }
  }, [online]);

  if (!online) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-destructive/90 px-3 py-1.5 text-xs font-medium text-destructive-foreground backdrop-blur">
        <WifiOff className="h-3.5 w-3.5" />
        <span>وضع عدم الاتصال — يتم عرض آخر البيانات المحفوظة</span>
        {queue.length > 0 && (
          <span className="rounded-full bg-background/20 px-2 py-0.5">
            {queue.length} في الانتظار
          </span>
        )}
      </div>
    );
  }

  if (syncing && queue.length > 0) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>مزامنة {queue.length} رسالة...</span>
      </div>
    );
  }

  if (justBackOnline) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
        <Wifi className="h-3.5 w-3.5" />
        <span>عاد الاتصال</span>
      </div>
    );
  }

  return null;
}
