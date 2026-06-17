import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { useCalls } from "@/lib/use-calls";

export const Route = createFileRoute("/app/calls")({
  component: CallsPage,
});

type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: "audio" | "video";
  status: string;
  started_at: string;
  duration_seconds: number;
  end_reason: string | null;
};
type Prof = { id: string; username: string; avatar_url: string | null };

function fmtDur(s: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m ? `${m} د ${ss} ث` : `${ss} ث`;
}

function relTime(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "الآن";
  if (d < 3600) return `قبل ${Math.floor(d / 60)} د`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} س`;
  if (d < 86400 * 7) return `قبل ${Math.floor(d / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function CallsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CallRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { startCall } = useCalls();

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order("started_at", { ascending: false })
        .limit(200);
      if (!mounted) return;
      const list = (data ?? []) as CallRow[];
      setRows(list);
      const ids = new Set<string>();
      list.forEach((r) => { ids.add(r.caller_id); ids.add(r.callee_id); });
      ids.delete(user.id);
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, username, avatar_url").in("id", Array.from(ids));
        const m = new Map<string, Prof>();
        (profs ?? []).forEach((p) => m.set(p.id, p as Prof));
        if (mounted) setProfiles(m);
      }
      setLoading(false);
    })();

    const ch = supabase
      .channel(`calls-list:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `caller_id=eq.${user.id}` }, () => {
        if (mounted) location.reload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` }, () => {
        if (mounted) location.reload();
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-primary/20 bg-primary text-primary-foreground px-3 py-3 shadow-sm" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <button onClick={() => navigate({ to: "/app" })} aria-label="رجوع" className="p-1.5 rounded-full hover:bg-primary-foreground/10">
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-lg font-semibold">المكالمات</h1>
      </header>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          <Phone className="mx-auto mb-3 h-10 w-10 opacity-40" />
          لا توجد مكالمات بعد
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const isOut = r.caller_id === user.id;
            const peerId = isOut ? r.callee_id : r.caller_id;
            const p = profiles.get(peerId);
            const missed = r.status === "missed" || (r.status === "canceled" && !isOut);
            const Icon = missed ? PhoneMissed : isOut ? PhoneOutgoing : PhoneIncoming;
            const color = missed ? "text-red-500" : "text-emerald-500";
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <Link to="/app/chats/$id" params={{ id: peerId }} className="flex flex-1 items-center gap-3 min-w-0">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-muted shrink-0">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400 to-cyan-500 text-white font-bold">
                        {p?.username?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${missed ? "text-red-500" : ""}`}>
                      {p?.username ?? "مستخدم"}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span>{isOut ? "صادرة" : missed ? "فائتة" : "واردة"}</span>
                      {r.duration_seconds > 0 && <span>· {fmtDur(r.duration_seconds)}</span>}
                      <span>· {relTime(r.started_at)}</span>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => p && startCall({ id: p.id, username: p.username, avatar_url: p.avatar_url }, r.call_type)}
                  className="p-2 rounded-full text-primary hover:bg-primary/10 active:scale-95"
                  aria-label="معاودة الاتصال"
                >
                  {r.call_type === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
