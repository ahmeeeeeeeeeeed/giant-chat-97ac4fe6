import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check, Loader2 } from "lucide-react";
import { resetBellCount } from "@/lib/bell-counter";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationsPage,
});

type Item = {
  otherId: string;
  username: string;
  avatar_url: string | null;
  last: string;
  message_type: string;
  created_at: string;
  unread: number;
};

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { resetBellCount(); }, []);



  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("sender_id, receiver_id, content, message_type, created_at, read_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);
    const acc = new Map<string, Item>();
    (msgs ?? []).forEach((m: any) => {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const cur = acc.get(otherId);
      const isUnread = m.receiver_id === user.id && !m.read_at;
      if (!cur) {
        acc.set(otherId, {
          otherId, username: "", avatar_url: null,
          last: m.content || (m.message_type === "image" ? "🖼️" : m.message_type === "voice" ? "🎙️" : ""),
          message_type: m.message_type, created_at: m.created_at, unread: isUnread ? 1 : 0,
        });
      } else if (isUnread) {
        cur.unread += 1;
      }
    });
    const ids = Array.from(acc.keys());
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
    const out: Item[] = ids.map(id => {
      const p = profs?.find(x => x.id === id);
      const it = acc.get(id)!;
      it.username = p?.username ?? "?"; it.avatar_url = p?.avatar_url ?? null;
      return it;
    });
    out.sort((a, b) => (b.unread - a.unread) || (b.created_at.localeCompare(a.created_at)));
    setItems(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", user.id).is("read_at", null);
    load();
  };

  const open = async (otherId: string) => {
    await supabase.rpc("dm_mark_read", { _peer: otherId });
    navigate({ to: "/app/chats/$id", params: { id: otherId } });
  };

  const totalUnread = items.reduce((s, i) => s + i.unread, 0);

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div>
          <h1 className="text-2xl font-extrabold">{t("notif.title")}</h1>
          <p className="text-xs text-muted-foreground">{totalUnread > 0 ? `${totalUnread} ${t("notif.unread")}` : t("chats.subtitle")}</p>
        </div>
        {totalUnread > 0 && (
          <button onClick={markAll} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
            <Check className="h-3.5 w-3.5" /> {t("notif.mark_all")}
          </button>
        )}
      </header>
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Bell className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("notif.empty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map(c => (
              <li key={c.otherId}>
                <button onClick={() => open(c.otherId)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition active:scale-[0.99] ${c.unread > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary font-bold">
                      {c.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`truncate ${c.unread > 0 ? "font-extrabold" : "font-semibold"}`}>{c.username}</div>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div className={`truncate text-sm ${c.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>{c.last}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
