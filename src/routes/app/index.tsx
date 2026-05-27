import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plus, Users, Hash, Loader2, X, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: RoomsPage,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  member_count?: number;
};

function RoomsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: roomsData } = await supabase
      .from("rooms")
      .select("id, name, description, owner_id")
      .order("created_at", { ascending: false });
    const { data: counts } = await supabase
      .from("room_members")
      .select("room_id");
    const map = new Map<string, number>();
    counts?.forEach((m) => map.set(m.room_id, (map.get(m.room_id) ?? 0) + 1));
    setRooms((roomsData ?? []).map((r) => ({ ...r, member_count: map.get(r.id) ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(r =>
      r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
    );
  }, [rooms, query]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
            <p className="text-xs text-muted-foreground">{t("rooms.title")}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95 transition"
            aria-label={t("rooms.create")}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-input bg-card px-3 h-11">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rooms.search")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rooms.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : filtered.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">{t("rooms.no_results")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  to="/app/rooms/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99] hover:border-foreground/20"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-accent text-foreground">
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    {r.description && <div className="truncate text-sm text-muted-foreground">{r.description}</div>}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {r.member_count}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && user && (
        <CreateRoomSheet
          ownerId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <Hash className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{t("rooms.empty")}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("rooms.subtitle")}</p>
      <button onClick={onCreate} className="mt-5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        {t("rooms.create")}
      </button>
    </div>
  );
}

function CreateRoomSheet({ ownerId, onClose, onCreated }: { ownerId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("rooms").insert({ name: name.trim(), description: desc.trim() || null, owner_id: ownerId });
    setBusy(false);
    if (error) { toast.error(t("common.error")); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border bg-card p-6 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("rooms.create_title")}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("rooms.name")}
            className="h-12 rounded-2xl border border-input bg-background px-4 outline-none focus:border-foreground" maxLength={50} required />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("rooms.description")}
            className="min-h-[80px] rounded-2xl border border-input bg-background p-4 outline-none focus:border-foreground" maxLength={200} />
          <button disabled={busy} className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("rooms.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
