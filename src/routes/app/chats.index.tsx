import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Loader2, Search, X } from "lucide-react";

export const Route = createFileRoute("/app/chats/")({
  component: ChatsPage,
});

type Convo = { otherId: string; username: string; avatar_url: string | null; last: string; created_at: string; unread: number };
type SearchProfile = { id: string; username: string; avatar_url: string | null };

function ChatsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("sender_id, receiver_id, content, created_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(300);
    const map = new Map<string, { last: string; created_at: string }>();
    (data ?? []).forEach(m => {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!map.has(otherId)) map.set(otherId, { last: m.content, created_at: m.created_at });
    });
    const ids = Array.from(map.keys());
    if (ids.length === 0) { setConvos([]); setLoading(false); return; }
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
    const out: Convo[] = ids.map(id => {
      const p = profs?.find(x => x.id === id);
      const last = map.get(id)!;
      return { otherId: id, username: p?.username ?? "?", avatar_url: p?.avatar_url ?? null, last: last.last, created_at: last.created_at };
    });
    setConvos(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("dm-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const q = query.trim();
    if (!q || !user) { setResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${q}%`)
        .neq("id", user.id)
        .limit(15);
      setResults((data ?? []) as SearchProfile[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(id);
  }, [query, user]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("chats.title")}</h1>
        <p className="text-xs text-muted-foreground">{t("chats.subtitle")}</p>
      </header>

      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن مستخدم لبدء محادثة…"
            className="h-11 w-full rounded-2xl border border-input bg-card pr-10 pl-10 text-sm outline-none focus:border-primary"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
            {searching ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : results.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">لا نتائج</p>
            ) : (
              <ul className="divide-y divide-border">
                {results.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate({ to: "/app/chats/$id", params: { id: p.id } })}
                      className="flex w-full items-center gap-3 p-3 text-start active:bg-secondary"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 truncate font-semibold">{p.username}</div>
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">دردشة</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : convos.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("chats.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">ابحث عن مستخدم في الأعلى لبدء محادثة جديدة</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {convos.map(c => (
              <li key={c.otherId}>
                <Link to="/app/chats/$id" params={{ id: c.otherId }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition active:scale-[0.99]">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary font-bold">
                      {c.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.username}</div>
                    <div className="truncate text-sm text-muted-foreground">{c.last}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
