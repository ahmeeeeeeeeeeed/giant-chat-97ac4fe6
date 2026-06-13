import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

type Profile = { id: string; username: string | null; avatar_url: string | null };

export function ShareTrackToUserModal({
  track, onClose,
}: { track: { title: string; artist: string; artwork: string; preview_url: string; duration_ms: number }; onClose: () => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${term}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      setResults((data ?? []) as Profile[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user]);

  const share = async (p: Profile) => {
    setSendingId(p.id);
    const { error } = await db.rpc("music_share_to_user", { _peer: p.id, _track: track });
    setSendingId(null);
    if (error) {
      if (error.message?.includes("recipient_dm_locked")) toast.error("هذا المستخدم قفل الرسائل الخاصة");
      else if (error.message?.includes("dm_blocked")) toast.error("لا يمكن الإرسال (حظر)");
      else toast.error(error.message);
      return;
    }
    toast.success(`تم إرسال الأغنية إلى ${p.username}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">مشاركة الأغنية مع مستخدم</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary/50 p-2">
          <img src={track.artwork} className="h-10 w-10 rounded-lg object-cover" alt="" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{track.title}</div>
            <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 h-11">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder="ابحث باسم المستخدم…"
            className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {q.trim() ? "لا نتائج" : "اكتب اسم المستخدم"}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((p) => (
                <li key={p.id}>
                  <button onClick={() => share(p)} disabled={sendingId === p.id}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-secondary disabled:opacity-50">
                    {p.avatar_url
                      ? <img src={p.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
                      : <div className="h-9 w-9 rounded-full bg-secondary" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.username || "—"}</div>
                    </div>
                    {sendingId === p.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
