import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Loader2, Search, X, Trash2, MoreVertical } from "lucide-react";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { getOnline } from "@/lib/use-online";
import { useCachedMediaSource } from "@/lib/use-cached-media";
import { StoryRing } from "@/components/StoryRing";
import { DM_CONVERSATIONS_EVENT, previewDMMessage, type DMConversation } from "@/lib/dm-delivery";
import { toast } from "sonner";


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
      convoCacheReadyRef.current = true;
    } else {
      console.info("[dm-cache] miss-local-list", { key: cacheKeys.chatsList(user.id), online: getOnline() });
      setLoading(true);
    }
    // Offline → skip the network entirely; cached list is authoritative for the UI.
    if (!getOnline()) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("sender_id, receiver_id, content, created_at, read_at, message_type")
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
          map.set(otherId, { last: previewDMMessage(m), created_at: m.created_at, unread: isUnreadForMe ? 1 : 0 });
        } else if (isUnreadForMe) {
          existing.unread += 1;
        }
      });
      const ids = Array.from(map.keys());
      if (ids.length === 0) { convoCacheReadyRef.current = true; setConvos([]); await cacheSet(cacheKeys.chatsList(user.id), []); setLoading(false); return; }
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      const out: Convo[] = ids.map(id => {
        const p = profs?.find(x => x.id === id);
        const last = map.get(id)!;
        return { otherId: id, username: p?.username ?? "?", avatar_url: p?.avatar_url ?? null, last: last.last, created_at: last.created_at, unread: last.unread };
      });
      convoCacheReadyRef.current = true;
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
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const onConversations = (event: Event) => {
      const detail = (event as CustomEvent<{ list?: DMConversation[] }>).detail;
      if (!detail?.list) return;
      console.info("[dm-list] realtime-list-applied", { count: detail.list.length });
      convoCacheReadyRef.current = true;
      setConvos(detail.list);
      setLoading(false);
    };
    window.addEventListener(DM_CONVERSATIONS_EVENT, onConversations);
    return () => window.removeEventListener(DM_CONVERSATIONS_EVENT, onConversations);
  }, [user?.id]);

  // Keep local cache in sync with the latest convo list state.
  useEffect(() => {
    if (!user) return;
    convoCacheReadyRef.current = false;
  }, [user?.id]);

  // Keep local cache in sync only after the local read path completed.
  useEffect(() => {
    if (!user) return;
    if (!convoCacheReadyRef.current) return;
    if (!getOnline() && convos.length === 0) return;
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
      <header className="sticky top-0 z-10 overflow-hidden border-b border-emerald-500/15 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950/60 px-5 py-5 backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,theme(colors.emerald.500/0.18),transparent_55%),radial-gradient(circle_at_85%_70%,theme(colors.cyan.500/0.10),transparent_55%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black text-white tracking-tight">{t("chats.title")}</h1>
            <p className="text-xs text-emerald-300/70">{t("chats.subtitle")}</p>
          </div>
        </div>
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
                  <ChatRow
                    convo={c}
                    unreadActive={unreadActive}
                    onDeleted={(id) => setConvos((prev) => prev.filter((x) => x.otherId !== id))}
                  />
                </li>
              );
            })}
          </ul>

        )}
      </div>
    </main>
  );
}

function ChatRow({ convo, unreadActive, onDeleted }: { convo: Convo; unreadActive: boolean; onDeleted: (id: string) => void }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const startPress = () => {
    longPressedRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setMenu(true);
      try { (navigator as any).vibrate?.(20); } catch { /* ignore */ }
    }, 450);
  };
  const cancelPress = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const onClick = (e: React.MouseEvent) => {
    if (longPressedRef.current || menu || confirming) { e.preventDefault(); e.stopPropagation(); return; }
    navigate({ to: "/app/chats/$id", params: { id: convo.otherId } });
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await (supabase as any).rpc("delete_conversation", { _other: convo.otherId });
      if (error) throw error;
      onDeleted(convo.otherId);
      toast.success("تم حذف المحادثة");
    } catch (e: any) {
      toast.error(e.message || "فشل الحذف");
    } finally {
      setDeleting(false);
      setConfirming(false);
      setMenu(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContext}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition active:scale-[0.99] cursor-pointer select-none ${
          unreadActive
            ? "border-emerald-400/40 bg-gradient-to-l from-emerald-950/55 via-emerald-950/30 to-transparent shadow-[0_10px_30px_-15px_rgba(16,185,129,0.55)]"
            : "border-emerald-500/10 bg-gradient-to-l from-slate-900/60 via-slate-900/30 to-transparent hover:border-emerald-500/25 hover:from-emerald-950/30"
        }`}
      >
        {unreadActive && (
          <span className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-600 shadow-[0_0_18px_2px_rgba(16,185,129,0.5)]" />
        )}
        <StoryRing userId={convo.otherId} size="sm"><CachedAvatar url={convo.avatar_url} username={convo.username} /></StoryRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="truncate font-bold text-foreground">{convo.username}</div>
          </div>
          <div className={`truncate text-sm ${unreadActive ? "text-emerald-200/90" : "text-muted-foreground"}`}>{convo.last}</div>
        </div>
        {unreadActive && (
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 px-2 text-[11px] font-extrabold text-emerald-950 shadow-[0_6px_18px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-200/50">
            {convo.unread > 99 ? "99+" : convo.unread}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setMenu(true); }}
          className="ml-1 grid h-9 w-9 place-items-center rounded-xl text-emerald-300/70 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/15 hover:text-emerald-200 transition"
          aria-label="خيارات المحادثة"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {menu && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setMenu(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-white/10 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 text-sm font-bold text-white truncate">{convo.username}</div>
            <button
              onClick={() => { setMenu(false); navigate({ to: "/app/chats/$id", params: { id: convo.otherId } }); }}
              className="w-full text-right rounded-xl px-3 py-2.5 text-sm text-white hover:bg-white/5"
            >
              فتح المحادثة
            </button>
            <button
              onClick={() => { setMenu(false); setConfirming(true); }}
              className="w-full text-right rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 justify-end"
            >
              حذف المحادثة <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !deleting && setConfirming(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-white">حذف المحادثة؟</h3>
            <p className="mt-2 text-sm text-white/70">
              سيتم حذف جميع الرسائل بينك وبين <span className="font-bold text-white">{convo.username}</span> نهائياً. لا يمكن التراجع.
            </p>
            <div className="mt-4 flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-xl px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/5 disabled:opacity-50"
              >إلغاء</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-gradient-to-br from-rose-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-600/30 disabled:opacity-60 flex items-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

