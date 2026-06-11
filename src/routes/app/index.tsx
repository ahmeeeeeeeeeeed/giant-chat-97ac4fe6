import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // جلب الغرف (بدون عمود type)
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("id, name, description, owner_id")
        .order("created_at", { ascending: false });
      
      if (roomsError) {
        setError(roomsError.message);
        setLoading(false);
        return;
      }
      
      // جلب عدد الأعضاء
      const { data: counts } = await supabase
        .from("room_members")
        .select("room_id");
      
      const map = new Map<string, number>();
      counts?.forEach((m) => map.set(m.room_id, (map.get(m.room_id) ?? 0) + 1));
      
      const roomsWithCount = (roomsData ?? []).map((r) => ({ 
        ...r, 
        member_count: map.get(r.id) ?? 0 
      }));
      
      setRooms(roomsWithCount);
      
    } catch (err) {
      setError("حدث خطأ في تحميل الغرف");
    }
    
    setLoading(false);
  };

  useEffect(() => {
    load();
    
    const ch = supabase
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, () => load())
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

  const goToCreateRoom = () => {
    navigate({ to: "/app/create-room" });
  };

  if (error) {
    return (
      <main className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
          <p className="text-xs text-muted-foreground">{t("rooms.title")}</p>
        </header>
        <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
          <div className="rounded-2xl bg-destructive/10 p-4 text-center">
            <p className="text-destructive mb-2">حدث خطأ في تحميل الغرف</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button onClick={load} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">{t("app.name")}</h1>
            <p className="text-xs text-muted-foreground">{t("rooms.title")}</p>
          </div>
          <button
            onClick={goToCreateRoom}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>غرفة جديدة</span>
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
          <div className="mt-20 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Hash className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">لا توجد غرف</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">قم بإنشاء أول غرفة الآن</p>
            <button onClick={goToCreateRoom} className="mt-5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              <Plus className="inline h-4 w-4 ml-1" />
              إنشاء غرفة جديدة
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">{t("rooms.no_results")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  to="/app/room/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99] hover:border-foreground/20"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-accent text-foreground">
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-semibold">{r.name}</span>
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
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowCreate(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get("name") as string;
            const desc = formData.get("description") as string;
            if (!name?.trim()) return;
            
            const { error } = await supabase.from("rooms").insert({ 
              name: name.trim(), 
              description: desc?.trim() || null, 
              owner_id: user.id 
            });
            
            if (error) { 
              toast.error("فشل إنشاء الغرفة: " + error.message); 
              return; 
            }
            
            toast.success("تم إنشاء الغرفة بنجاح");
            setShowCreate(false);
            load();
          }} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border bg-card p-6 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">إنشاء غرفة جديدة</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <input name="name" placeholder="اسم الغرفة" className="h-12 rounded-2xl border border-input bg-background px-4 outline-none focus:border-foreground" maxLength={50} required />
              <textarea name="description" placeholder="وصف الغرفة (اختياري)" className="min-h-[80px] rounded-2xl border border-input bg-background p-4 outline-none focus:border-foreground" maxLength={200} />
              <button type="submit" className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground">
                إنشاء
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}