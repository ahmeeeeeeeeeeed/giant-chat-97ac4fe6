import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/chats/$id")({
  component: DMPage,
});

type DM = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };
type Profile = { id: string; username: string; avatar_url: string | null };

function DMPage() {
  const { id: otherId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<DM[]>([]);
  const [other, setOther] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).maybeSingle();
      if (p) setOther(p as Profile);
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(300);
      setMessages((data ?? []) as DM[]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    })();
  }, [otherId, user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm:${user.id}:${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const r = payload.new as DM;
        if (
          (r.sender_id === user.id && r.receiver_id === otherId) ||
          (r.sender_id === otherId && r.receiver_id === user.id)
        ) {
          setMessages((old) => (old.some(x => x.id === r.id) ? old : [...old, r]));
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 30);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, otherId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, receiver_id: otherId, content,
    });
    setSending(false);
    if (error) { toast.error(t("common.error")); setText(content); }
  };

  return (
    <main className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate({ to: "/app/chats" })} aria-label={t("common.back")}>
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        {other?.avatar_url ? (
          <img src={other.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold">
            {(other?.username ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{other?.username ?? "…"}</h1>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("room.no_messages")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map(m => {
              const mine = m.sender_id === user?.id;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card border border-border"}`}>
                    <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("room.placeholder")}
          className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-[15px] outline-none focus:border-foreground" />
        <button type="submit" disabled={sending || !text.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
        </button>
      </form>
    </main>
  );
}
