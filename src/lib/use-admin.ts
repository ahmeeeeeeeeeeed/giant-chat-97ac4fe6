import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/use-online";

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
  useEffect(() => {
    if (!user) { setCount(0); return; }
    if (!online) { setCount(0); return; }
    let mounted = true;
    const load = async () => {
      try {
        const { count: c } = await supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .is("read_at", null);
        if (mounted) setCount(c ?? 0);
      } catch {
        if (mounted) setCount(0);
      }
    };
    load();
    const ch = supabase
      .channel(`dm-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user, online]);
  return count;
}
