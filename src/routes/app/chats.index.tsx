import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Loader2, Search, X } from "lucide-react";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { getOnline } from "@/lib/use-online";
import { useCachedMediaSource } from "@/lib/use-cached-media";


export const Route = createFileRoute("/app/chats/")({
  component: ChatsPage,
});

type Convo = { otherId: string; username: string; avatar_url: string | null; last: string; created_at: string; unread: number };
type SearchProfile = { id: string; username: string; avatar_url: string | null };

function CachedAvatar({ url, username }: { url: string | null; username: string }) {
  const source = useCachedMediaSource(url);
  if (source) {
    return <img src={source} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-emerald-500/30" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 font-bold text-emerald-300 ring-1 ring-emerald-500/30 shadow-inner">
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

function ChatsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const convoCacheReadyRef = useRef(false);

  const load = async () => {
    if (!user) return;
    const cached = await cacheGet<Convo[]>(cacheKeys.chatsList(user.id));
    if (cached) {
      console.info("[dm-cache] loaded-local-list", { key: cacheKeys.chatsList(user.id), count: cached.length, online: getOnline() });
      setConvos(cached); setLoading(false);
    } else {
      console.info("[dm-cache] miss-local-list", { key: cacheKeys.chatsList(user.id), online: getOnline() });
      setLoading(true);
    }
    convoCacheReadyRef.current = true;
    // Offline → skip the network entirely; cached list is authoritative for the UI.
    if (!getOnline()) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("sender_id, receiver_id, content, created_at, read_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const map = new Map<string, { last: string; created_at: string; unread: number }>();
      (data ?? []).forEach(m => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const existing = map.get(otherId);
        const isUnreadForMe = m.receiver_id === user.id && !m.read_at;
        if (!existing) {
          map.set(otherId, { last: m.content, created_at: m.created_at, unread: isUnreadForMe ? 1 : 0 });
        } else if (isUnreadForMe) {
          existing.unread += 1;
        }
      });
      const ids = Array.from(map.keys());
      if (ids.length === 0) { setConvos([]); await cacheSet(cacheKeys.chatsList(user.id), []); setLoading(false); return; }
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      const out: Convo[] = ids.map(id => {
        const p = profs?.find(x => x.id === id);
        const last = map.get(id)!;
        return { otherId: id, username: p?.username ?? "?", avatar_url: p?.avatar_url ?? null, last: last.last, created_at: last.created_at, unread: last.unread };
      });
      setConvos(out);
      console.info("[dm-cache] loaded-cloud-list", { key: cacheKeys.chatsList(user.id), count: out.length });
      await cacheSet(cacheKeys.chatsList(user.id), out);
    } catch {
      // offline — keep cached
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
    if (!user) return;
    if (!getOnline()) return;
    const ch = supabase
      .channel("dm-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep local cache in sync with the latest convo list state.
  useEffect(() => {
    if (!user) return;
    convoCacheReadyRef.current = false;
  }, [user?.id]);

  // Keep local cache in sync only after the local read path completed.
  useEffect(() => {
    if (!user) return;
    if (!convoCacheReadyRef.current) return;
    void cacheSet(cacheKeys.chatsList(user.id), convos);
  }, [convos, user]);

  // Re-sync as soon as connectivity returns.
  useEffect(() => {
    const onUp = () => { void load(); };
    window.addEventListener("online", onUp);
    return () => window.removeEventListener("online", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const q = query.trim();
    if (!q || !user) { setResults([]); return; }
    if (!getOnline()) { setResults([]); setSearching(false); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `%${q}%`)
          .neq("id", user.id)
          .limit(15);
        setResults((data ?? []) as SearchProfile[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, user]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-emerald-500/10 bg-slate-950/70 px-5 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">{t("chats.title")}</h1>
        <p className="text-xs text-emerald-300/60">{t("chats.subtitle")}</p>
      </header>

      <div className="px-4 pt-4">
        <div className="relative group">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن مستخدم لبدء محادثة…"
            className="h-12 w-full rounded-2xl border border-emerald-500/15 bg-emerald-950/20 pr-10 pl-10 text-sm text-foreground placeholder:text-emerald-700 outline-none transition focus:border-emerald-500/50 focus:bg-emerald-950/30 focus:ring-2 focus:ring-emerald-500/20"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute top-1/2 left-3 -translate-y-1/2 text-emerald-400/70 hover:text-emerald-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-emerald-500/15 bg-slate-950/60 backdrop-blur-xl">
            {searching ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" /></div>
            ) : results.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">لا نتائج</p>
            ) : (
              <ul className="divide-y divide-emerald-500/10">
                {results.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate({ to: "/app/chats/$id", params: { id: p.id } })}
                      className="flex w-full items-center gap-3 p-3 text-start transition active:bg-emerald-900/30 hover:bg-emerald-900/20"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-emerald-500/30" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 truncate font-semibold text-foreground">{p.username}</div>
                      <span className="rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.5)]">دردشة</span>
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
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>
        ) : convos.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <MessageSquare className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("chats.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">ابحث عن مستخدم في الأعلى لبدء محادثة جديدة</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {convos.map(c => {
              const unreadActive = c.unread > 0;
              return (
                <li key={c.otherId}>
                  <Link to="/app/chats/$id" params={{ id: c.otherId }}
                    className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition active:scale-[0.99] ${
                      unreadActive
                        ? "border-emerald-400/30 bg-emerald-950/40 shadow-[0_6px_20px_-12px_rgba(16,185,129,0.5)]"
                        : "border-emerald-500/10 bg-gradient-to-l from-emerald-950/15 to-transparent hover:bg-emerald-900/15"
                    }`}>
                    {unreadActive && (
                      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                    )}
                    <CachedAvatar url={c.avatar_url} username={c.username} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-foreground">{c.username}</div>
                      <div className={`truncate text-sm ${unreadActive ? "text-emerald-200/80" : "text-muted-foreground"}`}>{c.last}</div>
                    </div>
                    {unreadActive && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 px-2 text-[11px] font-bold text-white shadow-[0_4px_10px_-2px_rgba(16,185,129,0.6)]">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
