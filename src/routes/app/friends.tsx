import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, UserPlus, Check, X, Loader2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/friends")({
  component: FriendsPage,
});

type Profile = { id: string; username: string; avatar_url: string | null };
type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

function FriendsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"friends" | "requests" | "search">("friends");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const list = (data ?? []) as Friendship[];
    setFriendships(list);
    const ids = Array.from(new Set(list.flatMap(f => [f.requester_id, f.addressee_id])));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      const map: Record<string, Profile> = {};
      profs?.forEach(p => (map[p.id] = p as Profile));
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("friendships")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const friends = friendships.filter(f => f.status === "accepted");
  const incoming = friendships.filter(f => f.status === "pending" && f.addressee_id === user?.id);

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
      if (error) toast.error(t("common.error"));
    } else {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) toast.error(t("common.error"));
    }
  };

  const removeFriend = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) toast.error(t("common.error"));
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("friends.title")}</h1>
        <div className="mt-3 flex gap-1 rounded-2xl bg-secondary p-1">
          {(["friends", "requests", "search"] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {k === "friends" ? t("friends.my_friends") : k === "requests" ? `${t("friends.requests")}${incoming.length ? ` (${incoming.length})` : ""}` : t("common.search")}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {tab === "search" && <SearchUsers existing={friendships} />}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tab === "friends" ? (
          friends.length === 0 ? (
            <EmptyBox icon={<UsersIcon className="h-7 w-7 text-muted-foreground" />} text={t("friends.empty")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {friends.map(f => {
                const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                const p = profiles[otherId];
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <AvatarSm profile={p} />
                    <div className="flex-1 truncate font-medium">{p?.username ?? "…"}</div>
                    <button onClick={() => removeFriend(f.id)} className="rounded-full p-2 text-muted-foreground hover:text-destructive" aria-label={t("friends.remove")}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : tab === "requests" ? (
          incoming.length === 0 ? (
            <EmptyBox icon={<UserPlus className="h-7 w-7 text-muted-foreground" />} text={t("friends.empty")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {incoming.map(f => {
                const p = profiles[f.requester_id];
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <AvatarSm profile={p} />
                    <div className="flex-1 truncate font-medium">{p?.username ?? "…"}</div>
                    <button onClick={() => respond(f.id, true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={t("friends.accept")}>
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => respond(f.id, false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground" aria-label={t("friends.reject")}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </div>
    </main>
  );
}

function SearchUsers({ existing }: { existing: Friendship[] }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim() || !user) { setResults([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setBusy(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${q.trim()}%`)
        .neq("id", user.id)
        .limit(20);
      if (!ctrl.signal.aborted) {
        setResults((data ?? []) as Profile[]);
        setBusy(false);
      }
    }, 250);
    return () => { ctrl.abort(); clearTimeout(id); };
  }, [q, user]);

  const status = (otherId: string): "none" | "pending" | "accepted" => {
    const f = existing.find(x =>
      (x.requester_id === user?.id && x.addressee_id === otherId) ||
      (x.addressee_id === user?.id && x.requester_id === otherId)
    );
    if (!f) return "none";
    return f.status === "accepted" ? "accepted" : "pending";
  };

  const sendRequest = async (otherId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id, addressee_id: otherId, status: "pending",
    });
    if (error) toast.error(t("common.error"));
    else toast.success(t("friends.request_sent"));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3 h-11">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("friends.search")}
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {results.map(p => {
          const s = status(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <AvatarSm profile={p} />
              <div className="flex-1 truncate font-medium">{p.username}</div>
              {s === "accepted" ? (
                <span className="text-xs text-muted-foreground">✓</span>
              ) : s === "pending" ? (
                <span className="text-xs text-muted-foreground">{t("friends.pending")}</span>
              ) : (
                <button onClick={() => sendRequest(p.id)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <UserPlus className="h-3 w-3" />{t("friends.add")}
                </button>
              )}
            </li>
          );
        })}
        {q.trim() && !busy && results.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">{t("friends.no_users")}</li>
        )}
      </ul>
    </div>
  );
}

function AvatarSm({ profile }: { profile?: Profile }) {
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  const l = (profile?.username ?? "?").charAt(0).toUpperCase();
  return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">{l}</div>;
}

function EmptyBox({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">{icon}</div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
