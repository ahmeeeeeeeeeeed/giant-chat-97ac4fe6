import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/use-online";
import { useEvent } from "@/lib/events";

export function useIsAdmin() {
  const { user } = useAuth();
  const online = useOnline();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoaded(true); return; }
    if (!online) { setIsAdmin(false); setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancelled) { setIsAdmin(!!data); setLoaded(true); }
      } catch {
        if (!cancelled) { setIsAdmin(false); setLoaded(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [user, online]);
  return { isAdmin, loaded };
}

export function useUnreadDMCount() {
  const { user } = useAuth();
  const online = useOnline();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { count: c } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
      setCount(c ?? 0);
    } catch {
      setCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !online) { setCount(0); return; }
    load();
  }, [user, online, load]);

  useEvent("dm_received", (msg) => {
    if (msg.receiver_id === user?.id && !msg.read_at) {
      setCount(prev => prev + 1);
    }
  });

  useEvent("dm_read", () => {
    load();
  });

  return count;
}
