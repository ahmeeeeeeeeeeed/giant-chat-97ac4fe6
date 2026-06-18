import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, UserPlus, Search, X, Loader2, Users, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/app/rooms/$id/invites")({
  component: RoomInvitesPage,
});

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Invite = { id: string; user_id: string; created_at: string; profile?: Profile | null };

function RoomInvitesPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<{ name: string; owner_id: string; type: string } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const loadAll = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const { data: r } = await supabase.from("rooms").select("name,owner_id,type").eq("id", roomId).maybeSingle();
    setRoom(r as never);
    const { data: inv } = await supabase
      .from("room_invites" as never)
      .select("id,user_id,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    const list = (inv ?? []) as Invite[];
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", list.map((i) => i.user_id));
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      list.forEach((i) => (i.profile = map.get(i.user_id) ?? null));
    }
    setInvites(list);
    setLoading(false);
  }, [roomId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10);
      if (!cancelled) { setResults((data as never) ?? []); setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const invite = async (target: Profile) => {
    if (!user) return;
    if (target.id === user.id) { toast.error("لا يمكنك دعوة نفسك"); return; }
    if (invites.some((i) => i.user_id === target.id)) { toast.info("تمت دعوته مسبقاً"); return; }
    const { error } = await supabase.from("room_invites" as never).insert({
      room_id: roomId, user_id: target.id, invited_by: user.id,
    } as never);
    if (error) { toast.error("فشل الدعوة: " + error.message); return; }
    toast.success("تمت الدعوة");
    setSearch(""); setResults([]);
    loadAll();
  };

  const revoke = async (inviteId: string) => {
    if (!confirm("إزالة هذه الدعوة؟")) return;
    const { error } = await supabase.from("room_invites" as never).delete().eq("id", inviteId);
    if (error) { toast.error("فشل الإزالة"); return; }
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const isOwner = !!user && room?.owner_id === user.id;

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <button onClick={() => navigate({ to: "/app/rooms/$id", params: { id: roomId } })} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2">
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          <span>الرجوع للغرفة</span>
        </button>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الدعوات</h1>
        {room && <p className="text-sm text-muted-foreground">{room.name}</p>}
      </header>

      <div className="p-5 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !room ? (
          <p className="text-center text-muted-foreground py-10">الغرفة غير موجودة</p>
        ) : !isOwner ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 flex gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p className="text-sm">فقط مالك الغرفة يستطيع إدارة الدعوات.</p>
          </div>
        ) : (
          <>
            <section>
              <label className="block text-sm font-medium mb-2">ابحث عن مستخدم لدعوته</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم المستخدم أو الاسم الظاهر..."
                  className="w-full h-12 rounded-xl border border-input bg-background pr-10 pl-4 text-sm outline-none focus:border-primary" />
              </div>
              {searching && <p className="text-xs text-muted-foreground mt-2">جاري البحث...</p>}
              {results.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {results.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                        {p.avatar_url && <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.display_name || p.username || "مستخدم"}</p>
                        {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
                      </div>
                      <button onClick={() => invite(p)} className="flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                        <UserPlus className="h-3.5 w-3.5" /> دعوة
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">المدعوون ({invites.length})</h2>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 rounded-xl border border-dashed border-border">
                  لا يوجد مدعوون بعد
                </p>
              ) : (
                <ul className="space-y-2">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                        {i.profile?.avatar_url && <img src={i.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{i.profile?.display_name || i.profile?.username || "مستخدم"}</p>
                        {i.profile?.username && <p className="text-xs text-muted-foreground truncate">@{i.profile.username}</p>}
                      </div>
                      <button onClick={() => revoke(i.id)} className="flex items-center gap-1 h-9 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20">
                        <X className="h-3.5 w-3.5" /> إزالة
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
