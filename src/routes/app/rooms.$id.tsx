import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, Send, Loader2, Users, Plus, ArrowLeft, Hash } from "lucide-react";

export const Route = createFileRoute("/app/room/$id")({
  component: RoomPage,
});

function RoomPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRoom();
    loadMessages();
    checkMembership();
  }, [roomId]);

  const loadRoom = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error || !data) {
      toast.error("الغرفة غير موجودة");
      navigate({ to: "/app" });
      return;
    }

    setRoom(data);
    setLoading(false);
  };

  const checkMembership = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    setIsMember(!!data);
  };

  const joinRoom = async () => {
    if (!user || !room) return;

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
    });

    if (error) {
      toast.error("فشل الانضمام إلى الغرفة");
    } else {
      setIsMember(true);
      toast.success("تم الانضمام إلى الغرفة");
      loadMessages();
    }
  };

  const leaveRoom = async () => {
    if (!confirm("هل تريد مغادرة الغرفة؟")) return;
    
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user?.id);

    if (error) {
      toast.error("فشل مغادرة الغرفة");
    } else {
      setIsMember(false);
      toast.success("تم مغادرة الغرفة");
      navigate({ to: "/app" });
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 200);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;
    if (!isMember) {
      toast.error("يجب الانضمام إلى الغرفة أولاً");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
      content: text.trim(),
    });

    setSending(false);
    if (!error) {
      setText("");
      loadMessages();
    } else {
      toast.error("فشل إرسال الرسالة");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-background">
      {/* الهيدر */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <h1 className="font-bold">{room?.name}</h1>
              </div>
              {room?.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* زر إنشاء غرفة جديدة */}
            <button
              onClick={() => navigate({ to: "/app/create-room" })}
              className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20"
              title="إنشاء غرفة جديدة"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">غرفة جديدة</span>
            </button>
            
            {/* زر الانضمام/المغادرة */}
            {isMember ? (
              <button
                onClick={leaveRoom}
                className="rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
              >
                مغادرة
              </button>
            ) : (
              <button
                onClick={joinRoom}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                انضمام
              </button>
            )}
          </div>
        </div>
      </header>

      {/* عدد الأعضاء */}
      <div className="border-b border-border bg-secondary/30 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{room?.member_count || 0} عضو في هذه الغرفة</span>
        </div>
      </div>

      {/* الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Hash className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا توجد رسائل بعد</p>
              <p className="text-xs text-muted-foreground mt-1">كن أول من يكتب رسالة!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.user_id === user?.id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                {msg.user_id !== user?.id && (
                  <p className="text-xs font-semibold mb-1">{msg.username}</p>
                )}
                <p className="text-sm break-words">{msg.content}</p>
                <p className="text-[10px] opacity-70 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* إدخال الرسالة */}
      <form onSubmit={sendMessage} className="border-t border-border bg-background p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isMember ? "اكتب رسالة..." : "يجب الانضمام إلى الغرفة أولاً"}
            disabled={!isMember}
            className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || !isMember}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </main>
  );
}