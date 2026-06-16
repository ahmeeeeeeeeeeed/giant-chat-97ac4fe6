import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Gift, X, Loader2, Search, Globe, Users } from "lucide-react";

type Gift = {
  id: string;
  name: string;
  emoji: string | null;
  icon_url: string | null;
  cost_points: number;
  scope: "room" | "global";
  effect_type: "overlay" | "fullscreen" | "fly";
  category: string | null;
};

type Member = { user_id: string; username: string; avatar_url: string | null };

export function GiftPickerModal({
  roomId,
  onClose,
  presetReceiverId,
}: {
  roomId: string;
  onClose: () => void;
  presetReceiverId?: string | null;
}) {
  const { user } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [receiverId, setReceiverId] = useState<string | null>(presetReceiverId ?? null);
  const [scope, setScope] = useState<"room" | "global">("room");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [myPoints, setMyPoints] = useState(0);

  useEffect(() => {
    (async () => {
      const [g, m, p] = await Promise.all([
        supabase.from("gifts_catalog").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("room_members").select("user_id").eq("room_id", roomId),
        user ? supabase.from("profiles").select("points").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setGifts((g.data ?? []) as any);
      const ids = (m.data ?? []).map((x: any) => x.user_id).filter((id: string) => id !== user?.id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
        setMembers((profs ?? []).map((p: any) => ({ user_id: p.id, username: p.username, avatar_url: p.avatar_url })));
      }
      setMyPoints((p.data as any)?.points ?? 0);
    })();
  }, [roomId, user?.id]);

  const filteredGifts = gifts.filter((g) => g.scope === scope);
  const filteredMembers = members.filter((m) => !search || m.username?.toLowerCase().includes(search.toLowerCase()));

  async function send(gift: Gift) {
    if (!receiverId) {
      toast.error("اختر مستلم الهدية أولاً");
      return;
    }
    if (myPoints < gift.cost_points) {
      toast.error("نقاطك لا تكفي");
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("send_gift", {
      _receiver: receiverId,
      _gift: gift.id,
      _room: roomId,
      _message: null,
    });
    setSending(false);
    if (error) {
      toast.error("تعذر إرسال الهدية: " + error.message);
      return;
    }
    toast.success(`🎁 تم إرسال ${gift.emoji ?? ""} ${gift.name}`);
    setMyPoints((p) => p - gift.cost_points);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-background border border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-amber-500/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold">إرسال هدية</h3>
              <p className="text-[11px] text-muted-foreground">نقاطك: {myPoints.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Receiver */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">المستلم</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 mb-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن عضو..."
              className="flex-1 h-8 bg-transparent text-sm outline-none" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredMembers.map((m) => (
              <button key={m.user_id} onClick={() => setReceiverId(m.user_id)}
                className={`shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition ${
                  receiverId === m.user_id ? "bg-gradient-to-br from-pink-500/30 to-fuchsia-500/30 ring-2 ring-pink-500" : "hover:bg-secondary"
                }`}>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold overflow-hidden">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : (m.username?.[0] ?? "?").toUpperCase()}
                </div>
                <span className="text-[10px] max-w-[60px] truncate">{m.username}</span>
              </button>
            ))}
            {filteredMembers.length === 0 && <p className="text-xs text-muted-foreground py-3">لا يوجد أعضاء</p>}
          </div>
        </div>

        {/* Scope tabs */}
        <div className="flex gap-1 p-2 border-b border-border">
          <button onClick={() => setScope("room")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${scope === "room" ? "bg-secondary" : "text-muted-foreground"}`}>
            <Users className="h-3.5 w-3.5" /> داخل الغرفة
          </button>
          <button onClick={() => setScope("global")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${scope === "global" ? "bg-gradient-to-r from-amber-500/30 to-pink-500/30 text-foreground" : "text-muted-foreground"}`}>
            <Globe className="h-3.5 w-3.5" /> هدايا عالمية
          </button>
        </div>

        {/* Gifts grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {filteredGifts.map((g) => {
              const canAfford = myPoints >= g.cost_points;
              return (
                <button key={g.id} disabled={sending || !canAfford} onClick={() => send(g)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl border transition ${
                    canAfford ? "border-border bg-card hover:border-pink-500/40 hover:bg-pink-500/5 active:scale-95" : "border-border/40 bg-muted/30 opacity-60"
                  }`}>
                  {g.scope === "global" && (
                    <span className="absolute top-1 start-1 text-[8px] px-1 py-0.5 rounded bg-amber-500 text-white font-bold">عالمي</span>
                  )}
                  <div className="text-4xl">{g.emoji ?? "🎁"}</div>
                  <div className="text-[11px] font-medium truncate w-full text-center">{g.name}</div>
                  <div className="text-[10px] font-bold text-amber-600">{g.cost_points.toLocaleString()} ⭐</div>
                </button>
              );
            })}
          </div>
          {sending && (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-pink-500" /></div>
          )}
        </div>
      </div>
    </div>
  );
}
