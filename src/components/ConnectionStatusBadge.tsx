import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { getQueue, onQueueChange, type QueuedMessage } from "@/lib/offline-queue";

/**
 * Compact real-time connectivity indicator shown next to the logo in the header.
 * - Online + no queue: green "متصل"
 * - Online + pending queue: amber "وضع عدم الاتصال" (syncing local data)
 * - Offline: red "غير متصل"
 *
 * Colors come from semantic-ish utility classes so they can be themed later.
 */
export function ConnectionStatusBadge() {
  const online = useOnline();
  const [queue, setQueue] = useState<QueuedMessage[]>([]);

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

  const state: "online" | "offline" | "local" =
    !online ? "offline" : queue.length > 0 ? "local" : "online";

  const cfg = {
    online: {
      label: "متصل",
      Icon: Wifi,
      dot: "bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.7)]",
      text: "text-emerald-300",
      ring: "ring-emerald-400/30 bg-emerald-500/10",
    },
    offline: {
      label: "غير متصل",
      Icon: WifiOff,
      dot: "bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.6)]",
      text: "text-red-300",
      ring: "ring-red-400/30 bg-red-500/10",
    },
    local: {
      label: "وضع عدم الاتصال",
      Icon: CloudOff,
      dot: "bg-amber-400 shadow-[0_0_6px_2px_rgba(245,158,11,0.6)]",
      text: "text-amber-300",
      ring: "ring-amber-400/30 bg-amber-500/10",
    },
  }[state];

  const Icon = cfg.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      title={cfg.label}
      className={`hidden xs:inline-flex sm:inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ${cfg.ring} ${cfg.text} text-[9px] font-bold leading-none`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      <span className="whitespace-nowrap">{cfg.label}</span>
    </div>
  );
}
