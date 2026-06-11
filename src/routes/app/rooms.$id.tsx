import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowRight, Send, Loader2, Users, Lock, Unlock, 
  MoreVertical, Ban, UserX, UserCheck, Crown, 
  Shield, LogOut, Copy, Check, Trash2, MessageSquare,
  Plus, X, Search, DoorOpen, Settings, Volume2, VolumeX,
  Globe, Hash, Key
} from "lucide-react";

export const Route = createFileRoute("/app/room/$id")({
  component: RoomPage,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  type: "public" | "private";
  password: string | null;
  max_members: number;
  owner_id: string;
  is_active: boolean;
  member_count?: number;
};

type RoomMember = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_banned: boolean;
  is_muted: boolean;
  joined_at: string;
};

type Message = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
  is_admin: boolean;
};

function RoomPage() {
  const { id: roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showBanned, setShowBanned] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [isMember, setIsMember] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // تحميل بيانات الغرفة
  useEffect(() => {
    loadRoom();
    loadMessages();
    
    // الاشتراك في التحديثات المباشرة
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages" }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.room_id === roomId) {
          setMessages(prev => [...prev, newMsg]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, () => {
        loadMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const loadRoom = async () => {
    setLoading(true);
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
    
    // التحقق من صلاحيات المستخدم
    if (user) {
      setIsOwner(data.owner_id === user.id);
      await checkMembership(data.id);
    }
    
    setLoading(false);
  };

  const checkMembership = async (roomId: string) => {
    if (!user) return;
    
    const { data } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      setIsMember(false);
      if (room?.type === "private") {
        setNeedPassword(true);
      }
    } else {
      setIsMember(true);
      setIsAdmin(data.is_admin);
      if (data.is_banned) {
        toast.error("لقد تم حظرك من هذه الغرفة");
        navigate({ to: "/app" });
      }
    }
  };

  const joinRoom = async (password?: string) => {
    if (!user || !room) return;
    
    // التحقق من كلمة المرور للغرف الخاصة
    if (room.type === "private" && room.password && password !== room.password) {
      toast.error("كلمة المرور غير صحيحة");
      return;
    }

    // التحقق من الحد الأقصى للأعضاء
    if (room.member_count && room.member_count >= room.max_members) {
      toast.error("الغرفة ممتلئة (الحد الأقصى " + room.max_members + " أعضاء)");
      return;
    }

    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
      is_admin: false,
      is_banned: false,
      is_muted: false,
    });

    if (error) {
      toast.error("فشل الانضمام إلى الغرفة: " + error.message);
    } else {
      setNeedPassword(false);
      setIsMember(true);
      setIsAdmin(false);
      loadMembers();
      toast.success("تم الانضمام إلى الغرفة");
    }
  };

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (!error && data) {
      setMembers(data as RoomMember[]);
      // تحديث عدد الأعضاء في الغرفة
      if (room) {
        setRoom({ ...room, member_count: data.length });
      }
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
      setMessages(data as Message[]);
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
    
    const member = members.find(m => m.user_id === user.id);
    if (member?.is_muted) {
      toast.error("أنت مكتوم في هذه الغرفة");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      username: user.user_metadata?.username || "مستخدم",
      content: text.trim(),
      is_admin: isAdmin || isOwner,
    });

    setSending(false);
    if (error) {
      toast.error("فشل إرسال الرسالة");
    } else {
      setText("");
    }
  };

  // إدارة الأعضاء
  const banMember = async (memberId: string, username: string) => {
    if (!confirm(`هل تريد حظر ${username} من الغرفة؟`)) return;
    
    const { error } = await supabase
      .from("room_members")
      .update({ is_banned: true })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل حظر العضو");
    } else {
      toast.success(`تم حظر ${username}`);
      loadMembers();
    }
  };

  const unbanMember = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("room_members")
      .update({ is_banned: false })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل إلغاء الحظر");
    } else {
      toast.success(`تم إلغاء حظر ${username}`);
      loadMembers();
    }
  };

  const muteMember = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("room_members")
      .update({ is_muted: true })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل كتم العضو");
    } else {
      toast.success(`تم كتم ${username}`);
      loadMembers();
    }
  };

  const unmuteMember = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("room_members")
      .update({ is_muted: false })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل إلغاء الكتم");
    } else {
      toast.success(`تم إلغاء كتم ${username}`);
      loadMembers();
    }
  };

  const makeAdmin = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("room_members")
      .update({ is_admin: true })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل تعيين مشرف");
    } else {
      toast.success(`تم تعيين ${username} كمشرف`);
      loadMembers();
    }
  };

  const removeAdmin = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("room_members")
      .update({ is_admin: false })
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل إلغاء المشرف");
    } else {
      toast.success(`تم إلغاء مشرفية ${username}`);
      loadMembers();
    }
  };

  const removeMember = async (memberId: string, username: string) => {
    if (!confirm(`هل تريد طرد ${username} من الغرفة؟`)) return;
    
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("id", memberId)
      .eq("room_id", roomId);

    if (error) {
      toast.error("فشل طرد العضو");
    } else {
      toast.success(`تم طرد ${username}`);
      loadMembers();
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
      navigate({ to: "/app" });
    }
  };

  const generateInviteLink = () => {
    const link = `${window.location.origin}/invite/${roomId}`;
    setInviteLink(link);
    setShowInvite(true);
  };

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("تم نسخ رابط الدعوة");
  };

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bannedMembers = members.filter(m => m.is_banned);
  const activeMembers = members.filter(m => !m.is_banned);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needPassword && !isMember) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">غرفة خاصة</h2>
          <p className="text-sm text-muted-foreground mb-4">
            هذه الغرفة محمية بكلمة مرور. أدخل كلمة المرور للدخول.
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm mb-3"
            onKeyPress={(e) => e.key === "Enter" && joinRoom(passwordInput)}
          />
          <button
            onClick={() => joinRoom(passwordInput)}
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
    <main className="flex h-screen bg-background">
      {/* قائمة الأعضاء الجانبية */}
      <div className={`fixed right-0 top-0 z-20 h-full w-80 transform border-l border-border bg-background transition-transform duration-300 ${showMembers ? "translate-x-0" : "translate-x-full"} lg:relative lg:translate-x-0`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <h3 className="font-bold flex items-center gap-2">
            <Users className="h-4 w-4" />
            الأعضاء ({activeMembers.length}/{room?.max_members})
          </h3>
          <button onClick={() => setShowMembers(false)} className="lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* تبويبات */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setShowBanned(false); setShowAdminPanel(false); setShowInvite(false); }}
            className={`flex-1 py-2 text-sm font-medium ${!showBanned && !showAdminPanel && !showInvite ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            الأعضاء
          </button>
          {(isAdmin || isOwner) && (
            <button
              onClick={() => { setShowAdminPanel(true); setShowBanned(false); setShowInvite(false); }}
              className={`flex-1 py-2 text-sm font-medium ${showAdminPanel ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              الإدارة
            </button>
          )}
          {(isAdmin || isOwner) && bannedMembers.length > 0 && (
            <button
              onClick={() => { setShowBanned(true); setShowAdminPanel(false); setShowInvite(false); }}
              className={`flex-1 py-2 text-sm font-medium ${showBanned ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              محظورين ({bannedMembers.length})
            </button>
          )}
        </div>

        <div className="p-3">
          {/* شريط البحث */}
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 text-sm"
            />
          </div>

          {/* قائمة الأعضاء */}
          {!showBanned && !showAdminPanel && !showInvite && (
            <div className="space-y-1 max-h-[calc(100vh-150px)] overflow-y-auto">
              {filteredMembers.filter(m => !m.is_banned).map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{member.username}</span>
                        {member.user_id === room?.owner_id && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                        {member.is_admin && member.user_id !== room?.owner_id && (
                          <Shield className="h-3 w-3 text-blue-500" />
                        )}
                        {member.is_muted && (
                          <VolumeX className="h-3 w-3 text-orange-500" />
                        )}
                      </div>
                    </div>
                  </div>
                  {(isAdmin || isOwner) && member.user_id !== user?.id && member.user_id !== room?.owner_id && (
                    <div className="relative group">
                      <button className="p-1 rounded-lg hover:bg-secondary">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      <div className="absolute left-0 top-full mt-1 hidden group-focus-within:block group-hover:block z-10 bg-card border border-border rounded-lg shadow-lg min-w-36">
                        {member.is_muted ? (
                          <button onClick={() => unmuteMember(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                            <Volume2 className="h-4 w-4" />
                            إلغاء الكتم
                          </button>
                        ) : (
                          <button onClick={() => muteMember(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                            <VolumeX className="h-4 w-4" />
                            كتم
                          </button>
                        )}
                        <button onClick={() => banMember(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary">
                          <Ban className="h-4 w-4" />
                          حظر
                        </button>
                        <button onClick={() => removeMember(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary">
                          <UserX className="h-4 w-4" />
                          طرد
                        </button>
                        {isOwner && !member.is_admin && (
                          <button onClick={() => makeAdmin(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                            <Shield className="h-4 w-4" />
                            تعيين مشرف
                          </button>
                        )}
                        {isOwner && member.is_admin && (
                          <button onClick={() => removeAdmin(member.id, member.username)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                            <UserX className="h-4 w-4" />
                            إلغاء المشرفية
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredMembers.filter(m => !m.is_banned).length === 0 && (
                <p className="text-center text-muted-foreground py-4">لا يوجد أعضاء</p>
              )}
            </div>
          )}

          {/* قائمة المحظورين */}
          {showBanned && (
            <div className="space-y-1 max-h-[calc(100vh-150px)] overflow-y-auto">
              {bannedMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">لا يوجد أعضاء محظورين</p>
              ) : (
                bannedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-red-500/10">
                    <span className="text-sm">{member.username}</span>
                    <button
                      onClick={() => unbanMember(member.id, member.username)}
                      className="rounded-lg bg-green-500/10 p-1.5 text-green-500 hover:bg-green-500/20"
                    >
                      <UserCheck className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* لوحة الإدارة */}
          {showAdminPanel && (
            <div className="space-y-2">
              <button
                onClick={generateInviteLink}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                دعوة أعضاء جدد
              </button>
              <button
                onClick={() => {/* فتح إعدادات الغرفة */}}
                className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-sm hover:bg-secondary"
              >
                <Settings className="h-4 w-4" />
                إعدادات الغرفة
              </button>
              <button
                onClick={leaveRoom}
                className="flex w-full items-center gap-2 rounded-lg border border-destructive/20 p-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                مغادرة الغرفة
              </button>
            </div>
          )}

          {/* نافذة الدعوة */}
          {showInvite && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">شارك هذا الرابط لدعوة أصدقائك:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={copyInviteLink}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-sm text-muted-foreground">
                إغلاق
              </button>
            </div>
          )}
        </div>
      </div>

      {/* منطقة الدردشة الرئيسية */}
      <div className="flex-1 flex flex-col">
        {/* هيدر الغرفة */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate({ to: "/app" })} className="rounded-lg p-2 hover:bg-secondary">
              <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold">{room?.name}</h1>
                {room?.type === "private" ? (
                  <Lock className="h-3 w-3 text-amber-500" />
                ) : (
                  <Globe className="h-3 w-3 text-green-500" />
                )}
              </div>
              {room?.description && (
                <p className="text-xs text-muted-foreground">{room.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* زر الانضمام للغرف العامة */}
            {!isMember && room?.type === "public" && (
              <button
                onClick={() => joinRoom()}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                انضمام
              </button>
            )}
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="relative rounded-lg p-2 hover:bg-secondary lg:hidden"
            >
              <Users className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeMembers.length}
              </span>
            </button>
            {(isAdmin || isOwner) && (
              <button
                onClick={generateInviteLink}
                className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary/20"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>

        {/* رسالة إذا لم يكن عضواً */}
        {!isMember && room?.type === "private" && (
          <div className="bg-amber-500/10 text-amber-600 text-center py-3 px-4 text-sm">
            <Lock className="inline h-4 w-4 ml-1" />
            هذه غرفة خاصة. أدخل كلمة المرور للانضمام.
          </div>
        )}

        {!isMember && room?.type === "public" && (
          <div className="bg-blue-500/10 text-blue-600 text-center py-3 px-4 text-sm">
            <Globe className="inline h-4 w-4 ml-1" />
            هذه غرفة عامة. اضغط على "انضمام" للدخول والمشاركة.
          </div>
        )}

        {/* الرسائل */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-muted-foreground">
                لا توجد رسائل بعد
                <br />
                <span className="text-xs">كن أول من يرسل رسالة!</span>
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.user_id === user?.id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  {msg.user_id !== user?.id && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-semibold">{msg.username}</span>
                      {msg.is_admin && <Shield className="h-3 w-3 text-blue-500" />}
                    </div>
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

        {/* إدخال الرسالة (فقط للأعضاء) */}
        {isMember ? (
          <form onSubmit={sendMessage} className="border-t border-border bg-background p-4">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب رسالة..."
                className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary"
                disabled={!isMember}
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
        ) : (
          <div className="border-t border-border bg-background p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {room?.type === "private" ? "أدخل كلمة المرور للانضمام إلى الغرفة" : "اضغط على زر 'انضمام' للدخول إلى الغرفة"}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}