import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { 
  Shield, Users, Search, Ban, Trash2, Eye, Coins, 
  Send, MessageSquare, Lock, Unlock, Loader2, X, CheckCircle, XCircle
} from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  created_at: string;
};

type Room = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  member_count: number;
};

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "rooms">("users");
  
  // المستخدمين
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [sendingPoints, setSendingPoints] = useState<string | null>(null);
  const [pointsAmount, setPointsAmount] = useState<Record<string, string>>({});
  
  // الغرف
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // البث العام
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // التحقق من صلاحيات الأدمن
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      
      // اجعل أول مستخدم مسجل هو الأدمن
      const { data: firstUser } = await supabase
        .from("profiles")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      
      setIsAdmin(firstUser?.id === user.id);
      setLoadingAuth(false);
      
      if (firstUser?.id !== user.id) {
        toast.error("غير مصرح لك بالدخول");
        navigate({ to: "/app" });
      }
    };
    
    checkAdmin();
  }, [user, navigate]);

  // جلب المستخدمين
  const loadUsers = async () => {
    setLoadingUsers(true);
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, points, created_at")
      .order("created_at", { ascending: false });
    
    if (searchUser) {
      query = query.ilike("username", `%${searchUser}%`);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  // جلب الغرف
  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, type, is_active")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      // جلب عدد الأعضاء لكل غرفة
      const roomsWithCount = await Promise.all(
        data.map(async (room) => {
          const { count } = await supabase
            .from("room_members")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id);
          return { ...room, member_count: count || 0 };
        })
      );
      setRooms(roomsWithCount);
    }
    setLoadingRooms(false);
  };

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === "users") loadUsers();
      if (activeTab === "rooms") loadRooms();
    }
  }, [isAdmin, activeTab, searchUser]);

  // حظر مستخدم
  const handleBanUser = async (userId: string) => {
    if (!confirm("هل تريد حظر هذا المستخدم؟")) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: true })
        .eq("id", userId);
      if (error) throw error;
      toast.success("تم حظر المستخدم");
      loadUsers();
    } catch {
      toast.error("فشل الحظر (قد لا يوجد عمود is_banned)");
    }
  };

  // حذف مستخدم
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`هل تريد حذف المستخدم "${username}" نهائياً؟`)) return;
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      toast.success(`تم حذف ${username}`);
      loadUsers();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  // إرسال نقاط
  const handleSendPoints = async (userId: string, username: string) => {
    const amount = parseInt(pointsAmount[userId] || "0", 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("أدخل عدد نقاط صحيح");
      return;
    }
    
    setSendingPoints(userId);
    
    const { data: userData } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .single();
    
    const currentPoints = userData?.points || 0;
    const { error } = await supabase
      .from("profiles")
      .update({ points: currentPoints + amount })
      .eq("id", userId);
    
    setSendingPoints(null);
    
    if (error) {
      toast.error("فشل إرسال النقاط");
    } else {
      toast.success(`تم إرسال ${amount} نقطة إلى ${username}`);
      setPointsAmount(prev => ({ ...prev, [userId]: "" }));
      loadUsers();
    }
  };

  // إرسال رسالة عامة (بث)
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      toast.error("أدخل نص الرسالة");
      return;
    }
    
    setSendingBroadcast(true);
    
    const { error } = await supabase
      .from("announcements")
      .insert({
        title: "بث إداري",
        content: broadcastMsg.trim(),
        is_active: true,
      });
    
    setSendingBroadcast(false);
    
    if (error) {
      toast.error("فشل إرسال البث");
    } else {
      toast.success("تم إرسال الرسالة لجميع المستخدمين");
      setBroadcastMsg("");
    }
  };

  // تعطيل/تفعيل غرفة
  const toggleRoom = async (roomId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("rooms")
      .update({ is_active: !currentStatus })
      .eq("id", roomId);
    
    if (error) {
      toast.error("فشل تغيير حالة الغرفة");
    } else {
      toast.success(!currentStatus ? "تم تفعيل الغرفة" : "تم تعطيل الغرفة");
      loadRooms();
    }
  };

  // حذف غرفة
  const deleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`هل تريد حذف الغرفة "${roomName}"؟`)) return;
    
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) {
      toast.error("فشل حذف الغرفة");
    } else {
      toast.success(`تم حذف ${roomName}`);
      loadRooms();
    }
  };

  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!isAdmin) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">غير مصرح لك بالدخول</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* الهيدر */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">لوحة التحكم</h1>
              <p className="text-xs text-muted-foreground">إدارة المستخدمين والغرف</p>
            </div>
          </div>
          <button onClick={() => navigate({ to: "/app" })} className="rounded-xl bg-secondary px-4 py-2 text-sm">
            العودة
          </button>
        </div>
      </header>

      {/* تبويبات */}
      <div className="flex border-b border-border px-5">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          المستخدمين ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("rooms")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "rooms" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          الغرف ({rooms.length})
        </button>
      </div>

      <div className="p-5">
        {/* تبويب المستخدمين */}
        {activeTab === "users" && (
          <div>
            {/* شريط البحث */}
            <div className="relative max-w-sm mb-4">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث عن مستخدم..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background pr-10 pl-4 text-sm"
              />
            </div>

            {/* جدول المستخدمين */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">المستخدم</th>
                    <th className="p-3">النقاط</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">لا توجد مستخدمين</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{u.username}</span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-primary">{u.points}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {/* زر إرسال نقاط */}
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="نقاط"
                                value={pointsAmount[u.id] || ""}
                                onChange={(e) => setPointsAmount(prev => ({ ...prev, [u.id]: e.target.value }))}
                                className="w-20 h-8 rounded-lg border border-input bg-background px-2 text-sm"
                              />
                              <button
                                onClick={() => handleSendPoints(u.id, u.username)}
                                disabled={sendingPoints === u.id}
                                className="rounded-lg bg-yellow-500/10 p-1.5 text-yellow-500 hover:bg-yellow-500/20"
                                title="إرسال نقاط"
                              >
                                {sendingPoints === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                              </button>
                            </div>
                            
                            {/* زر فتح البروفايل */}
                            <button
                              onClick={() => navigate({ to: "/app/profile/$id", params: { id: u.id } })}
                              className="rounded-lg bg-blue-500/10 p-1.5 text-blue-500 hover:bg-blue-500/20"
                              title="عرض البروفايل"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {/* زر حظر */}
                            <button
                              onClick={() => handleBanUser(u.id)}
                              className="rounded-lg bg-red-500/10 p-1.5 text-red-500 hover:bg-red-500/20"
                              title="حظر"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                            
                            {/* زر حذف */}
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* تبويب الغرف */}
        {activeTab === "rooms" && (
          <div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">الغرفة</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">الأعضاء</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingRooms ? (
                    <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : rooms.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد غرف</td></tr>
                  ) : (
                    rooms.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3">{r.type === "private" ? "خاصة" : "عامة"}</td>
                        <td className="p-3">{r.member_count}</td>
                        <td className="p-3">
                          {r.is_active ? (
                            <span className="text-green-500">نشطة</span>
                          ) : (
                            <span className="text-red-500">معطلة</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleRoom(r.id, r.is_active)}
                              className="rounded-lg bg-blue-500/10 p-1.5 text-blue-500 hover:bg-blue-500/20"
                              title={r.is_active ? "تعطيل" : "تفعيل"}
                            >
                              {r.is_active ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => deleteRoom(r.id, r.name)}
                              className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* قسم البث العام (يظهر في كل التبويبات) */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Send className="h-5 w-5 text-blue-500" />
            <h3 className="font-bold">إرسال رسالة عامة (بث لجميع المستخدمين)</h3>
          </div>
          <div className="flex gap-2">
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="اكتب رسالة سترسل لجميع المستخدمين..."
              rows={2}
              className="flex-1 rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleBroadcast}
              disabled={sendingBroadcast}
              className="rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sendingBroadcast ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}