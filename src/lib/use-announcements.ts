import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOnline } from "@/lib/use-online";

const SEEN_KEY = "announce:last_seen_at";

// Subscribes globally to admin announcements and shows them as a top toast
// for every signed-in user, regardless of which page or room they're in.
export function useAnnouncementsListener(enabled: boolean) {
  const shownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!getOnline()) return;

    let cancelled = false;
    const lastSeen = localStorage.getItem(SEEN_KEY) ?? new Date(Date.now() - 60_000).toISOString();

    // Show any announcements created since this device last saw one.
    (async () => {
      let data: { id: string; content: string; created_at: string }[] | null = null;
      try {
        const res = await supabase
          .from("announcements")
          .select("id, content, created_at")
          .gt("created_at", lastSeen)
          .order("created_at", { ascending: true })
          .limit(10);
        data = res.data;
      } catch {
        data = null;
      }
      if (cancelled || !data) return;
      for (const a of data) {
        if (shownIds.current.has(a.id)) continue;
        shownIds.current.add(a.id);
        toast(`📢 ${a.content}`, { duration: 8000 });
      }
      if (data.length) localStorage.setItem(SEEN_KEY, data[data.length - 1].created_at);
    })();

    const ch = supabase
      .channel("announcements:global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (p) => {
          const row: any = p.new;
          if (!row?.id || shownIds.current.has(row.id)) return;
          shownIds.current.add(row.id);
          toast(`📢 ${row.content}`, { duration: 8000 });
          if (row.created_at) localStorage.setItem(SEEN_KEY, row.created_at);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [enabled]);
}
