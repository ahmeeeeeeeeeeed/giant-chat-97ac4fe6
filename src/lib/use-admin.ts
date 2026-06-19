import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/use-online";
import { cacheGet, cacheKeys } from "@/lib/offline-cache";
import { DM_CONVERSATIONS_EVENT, type DMConversation } from "@/lib/dm-delivery";

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
    const cached = await cacheGet<DMConversation[]>(cacheKeys.chatsList(user.id));
    if (cached) setCount(cached.reduce((sum, c) => sum + c.unread, 0));
    try {
      const { count: c } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
      if (cached) setCount((prev) => Math.max(prev, c ?? 0));
      else setCount(c ?? 0);
    } catch {
      if (!cached) setCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    if (!online) { void load(); return; }
    void load();
  }, [user, online, load]);

  useEffect(() => {
    if (!user) return;
    const onConversations = (event: Event) => {
      const detail = (event as CustomEvent<{ list?: DMConversation[] }>).detail;
      if (!detail?.list) return;
      setCount(detail.list.reduce((sum, c) => sum + c.unread, 0));
    };
    window.addEventListener(DM_CONVERSATIONS_EVENT, onConversations);
    return () => window.removeEventListener(DM_CONVERSATIONS_EVENT, onConversations);
  }, [user?.id]);

  return count;
}
