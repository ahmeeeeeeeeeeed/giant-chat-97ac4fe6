import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Send, Loader2, ArrowLeft, Users, Hash } from "lucide-react";

export const Route = createFileRoute("/app/rooms/$id")({
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
  const [memberCount, setMemberCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // تحميل بيانات الغرفة
  useEffect(() => {
    loadRoom();
    loadMessages();
    checkMembership();
    loadMemberCount();
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

  const loadMemberCount = async () => {
    const { count, error } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    if (!error && count !== null) {
      setMemberCount(count);
    }
  };

  const joinRoom = async () => {
    if (!user || !room) return;

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
    } as never);

    if (error) {
      toast.error("فشل الانضمام إلى الغرفة");
    } else {
      setIsMember(true);
      loadMemberCount();
      toast.success("تم الانضمام إلى الغرفة");
    }
  };

  const leaveRoom = async () => {
    if (!confirm("هل تريد مغادرة الغرفة؟")) return;
    
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user!.id);

    if (error) {
      toast.error("فشل مغادرة الغرفة");
    } else {
      setIsMember(false);
      loadMemberCount();
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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
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
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">الغرفة غير موجودة</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* الهيدر */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate({ to: "/app" })} 
            className="rounded-lg p-2 hover:bg-secondary transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h1 className="font-bold text-lg">{room.name}</h1>
            </div>
            {room.description && (
              <p className="text-xs text-muted-foreground">{room.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* عدد الأعضاء */}
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1 text-xs">
            <Users className="h-3 w-3" />
            <span>{memberCount}</span>
          </div>
          
          {/* زر الانضمام/المغادرة */}
          {isMember ? (
            <button
              onClick={leaveRoom}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/20 transition"
            >
              مغادرة
            </button>
          ) : (
            <button
              onClick={joinRoom}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              انضمام
            </button>
          )}
        </div>
      </header>

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Hash className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد رسائل بعد</p>
            <p className="text-xs text-muted-foreground mt-1">كن أول من يكتب رسالة!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1 text-muted-foreground">{msg.username}</p>
                  )}
                  <p className="text-sm break-words">{msg.content}</p>
                  <p className="text-[10px] opacity-70 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
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
            className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || !isMember}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition hover:bg-primary/90"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}