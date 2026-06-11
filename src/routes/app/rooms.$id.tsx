import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, Send, Loader2, Users, Lock, ArrowLeft } from "lucide-react";

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
  const [passwordInput, setPasswordInput] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRoom();
    loadMessages();
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
    
    if (data.type === "private" && data.password) {
      setNeedPassword(true);
    }
    
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!user || !room) return;
    
    if (room.type === "private" && room.password && passwordInput !== room.password) {
      toast.error("كلمة المرور غير صحيحة");
      return;
    }

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
    });

    if (error) {
      toast.error("فشل الانضمام إلى الغرفة");
    } else {
      setNeedPassword(false);
      toast.success("تم الانضمام إلى الغرفة");
      loadMessages();
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!error && data) {
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 200);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;

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

  if (needPassword) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">غرفة خاصة</h2>
          <p className="text-sm text-muted-foreground mb-4">
            هذه الغرفة محمية بكلمة مرور
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm mb-3"
          />
          <button
            onClick={joinRoom}
            className="w-full h-11 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            دخول
          </button>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="w-full h-11 rounded-xl border border-border mt-3"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold">{room?.name}</h1>
            {room?.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-muted-foreground">لا توجد رسائل بعد</p>
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
                  {new Date(msg.created_at).toLocaleTimeString("ar")}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-border bg-background p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب رسالة..."
            className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </main>
  );
}