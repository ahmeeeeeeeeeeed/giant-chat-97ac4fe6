import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  Shield, Coins, Megaphone, Loader2, Users, MessageSquare, 
  Ban, Trash2, UserX, UserCheck, Search, 
  Eye, ChevronLeft, ChevronRight, RefreshCw,
  Flag, CheckCircle, XCircle
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  created_at: string;
  is_banned?: boolean;
};

type Room = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  created_at: string;
};

function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<"users" | "rooms" | "points">("users");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // المستخدمين
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [userPage, setUserPage] = useState(0);
  
  // الغرف
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomPage, setRoomPage] = useState(0);
  
  // النقاط
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingPts, setSendingPts] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBc, setSendingBc] = useState(false);
  
  const itemsPerPage = 10;

  // التحقق من صلاحيات الأدمن
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      
      // التحقق من وجود عمود is_admin (إذا لم يكن موجوداً، اعتبر أول مستخدم هو الأدمن)
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      
      // إذا لم يوجد عمود is_admin، اجعل أول مستخدم مسجل هو الأدمن
      if (error || !data) {
        const { data: firstUser } = await supabase
          .from("profiles")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        
        setIsAdmin(firstUser?.id === user.id);
      } else {
        setIsAdmin(data.is_admin === true);
      }
      
      setLoadingAuth(false);
      
      if (!isAdmin && !loadingAuth) {
        toast.error("غير مصرح لك بالدخول إلى لوحة التحكم");
        navigate({ to: "/app" });
      }
    };
    
    checkAdmin();
  }, [user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === "users") loadUsers();
      if (activeTab === "rooms") loadRooms();
    }
  }, [isAdmin, activeTab, searchUser]);

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
    
    if (error) {
      toast.error("خطأ في جلب المستخدمين");
    } else {
      setUsers(data as Profile[]);
    }
    setLoadingUsers(false);
  };

  // جلب الغرف
  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description, type, is_active, created_at")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("خطأ في جلب الغرف");
      setRooms([]);
    } else {
      setRooms(data as Room[]);
    }
    setLoadingRooms(false);
  };

  // حظر مستخدم (تحديث قاعدة البيانات)
  const handleBanUser = async (userId: string, isBanned: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: isBanned })
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: isBanned } : u));
      toast.success(isBanned ? "تم حظر المستخدم" : "تم إلغاء حظر المستخدم");
    } catch (error) {
      toast.error("فشل العملية. قد يكون عمود is_banned غير موجود في قاعدة البيانات");
    }
  };

  // حذف مستخدم
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      
      setUsers(users.filter(u => u.id !== userId));
      toast.success(`تم حذف المستخدم ${username}`);
    } catch (error) {
      toast.error("فشل حذف المستخدم");
    }
  };

  // تعطيل/تفعيل غرفة
  const toggleRoomStatus = async (roomId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ is_active: !currentActive })
        .eq("id", roomId);
      
      if (error) throw error;
      
      setRooms(rooms.map(r => r.id === roomId ? { ...r, is_active: !currentActive } : r));
      toast.success(!currentActive ? "تم تفعيل الغرفة" : "تم تعطيل الغرفة");
    } catch (error) {
      toast.error("فشل تغيير حالة الغرفة");
    }
  };

  // حذف غرفة
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الغرفة "${roomName}"؟`)) return;
    
    try {
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);
      if (error) throw error;
      
      setRooms(rooms.filter(r => r.id !== roomId));
      toast.success(`تم حذف الغرفة ${roomName}`);
    } catch (error) {
      toast.error("فشل حذف الغرفة");
    }
  };

  // إرسال نقاط
  const sendPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!username.trim() || isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال اسم مستخدم وعدد نقاط صحيح");
      return;
    }
    
    setSendingPts(true);
    
    const { data: prof, error: findError } = await supabase
      .from("profiles")
      .select("id, points")
      .eq("username", username.trim())
      .maybeSingle();
    
    if (findError || !prof) {
      setSendingPts(false);
      toast.error("المستخدم غير موجود");
      return;
    }
    
    const currentPoints = prof.points || 0;
    const { error } = await supabase
      .from("profiles")
      .update({ points: currentPoints + amt })
      .eq("id", prof.id);
    
    setSendingPts(false);
    
    if (error) {
      toast.error("فشل إرسال النقاط");
    } else {
      toast.success(`تم إرسال ${amt} نقطة إلى ${username}`);
      setUsername("");
      setAmount("");
      loadUsers();
    }
  };

  // إرسال بث جماعي (إشعار)
  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.trim()) return;
    
    setSendingBc(true);
    
    // حفظ البث في جدول announcements
    const { error } = await supabase
      .from("announcements")
      .insert({
        title: "بث إداري",
        content: broadcast.trim(),
        is_active: true,
      });
    
    setSendingBc(false);
    
    if (error) {
      toast.error("فشل إرسال البث: " + (error.message || "خطأ غير معروف"));
    } else {
      toast.success("تم إرسال البث لجميع المستخدمين");
      setBroadcast("");
    }
  };

  // ترقيم الصفحات
  const paginatedUsers = users.slice(userPage * itemsPerPage, (userPage + 1) * itemsPerPage);
  const totalUserPages = Math.ceil(users.length / itemsPerPage);
  const paginatedRooms = rooms.slice(roomPage * itemsPerPage, (roomPage + 1) * itemsPerPage);
  const totalRoomPages = Math.ceil(rooms.length / itemsPerPage);

  if (loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        غير مصرح لك بالدخول إلى لوحة التحكم
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">لوحة التحكم</h1>
              <p className="text-xs text-muted-foreground">إدارة المستخدمين والغرف</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold hover:bg-secondary/80"
          >
            العودة للتطبيق
          </button>
        </div>
      </header>

      {/* تبويبات */}
      <div className="border-b border-border">
        <div className="flex px-4 gap-1">
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users className="h-4 w-4" />} label="المستخدمين" />
          <TabButton active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} icon={<MessageSquare className="h-4 w-4" />} label="الغرف" />
          <TabButton active={activeTab === "points"} onClick={() => setActiveTab("points")} icon={<Coins className="h-4 w-4" />} label="نقاط وبث" />
        </div>
      </div>

      <div className="p-6">
        {/* المستخدمين */}
        {activeTab === "users" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="بحث عن مستخدم..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background pr-10 pl-4 text-sm"
                />
              </div>
              <button onClick={loadUsers} className="rounded-xl bg-secondary px-4 text-sm">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">المستخدم</th>
                    <th className="p-3">النقاط</th>
                    <th className="p-3">تاريخ التسجيل</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا توجد مستخدمين</td></tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-bold text-sm">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{u.username}</span>
                          </div>
                        </td>
                        <td className="p-3">{u.points}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar")}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <ActionButton onClick={() => handleBanUser(u.id, true)} icon={<Ban className="h-4 w-4" />} color="red" title="حظر" />
                            <ActionButton onClick={() => handleDeleteUser(u.id, u.username)} icon={<Trash2 className="h-4 w-4" />} color="red" title="حذف" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalUserPages > 1 && <Pagination page={userPage} totalPages={totalUserPages} onPageChange={setUserPage} />}
          </div>
        )}

        {/* الغرف */}
        {activeTab === "rooms" && (
          <div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">الغرفة</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingRooms ? (
                    <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : paginatedRooms.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا توجد غرف</td></tr>
                  ) : (
                    paginatedRooms.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3">{r.type === "private" ? "خاصة" : "عامة"}</td>
                        <td className="p-3">
                          {r.is_active ? (
                            <span className="text-green-500">نشطة</span>
                          ) : (
                            <span className="text-red-500">معطلة</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <ActionButton onClick={() => toggleRoomStatus(r.id, r.is_active)} icon={r.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />} color="blue" title={r.is_active ? "تعطيل" : "تفعيل"} />
                            <ActionButton onClick={() => handleDeleteRoom(r.id, r.name)} icon={<Trash2 className="h-4 w-4" />} color="red" title="حذف" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalRoomPages > 1 && <Pagination page={roomPage} totalPages={totalRoomPages} onPageChange={setRoomPage} />}
          </div>
        )}

        {/* النقاط والبث */}
        {activeTab === "points" && (
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Coins className="h-5 w-5 text-yellow-500" /> إرسال نقاط</h2>
              <form onSubmit={sendPoints} className="space-y-3">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="عدد النقاط" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <button type="submit" disabled={sendingPts} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
                  {sendingPts ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "إرسال"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-500" /> بث جماعي</h2>
              <form onSubmit={sendBroadcast} className="space-y-3">
                <textarea value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder="نص البث..." rows={4} className="w-full rounded-xl border border-input bg-background p-4 text-sm" />
                <button type="submit" disabled={sendingBc} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
                  {sendingBc ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "إرسال البث"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// المكونات المساعدة
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
      {icon} {label}
    </button>
  );
}

function ActionButton({ onClick, icon, color, title }: { onClick: () => void; icon: React.ReactNode; color: string; title: string }) {
  return (
    <button onClick={onClick} className="rounded-lg p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20" title={title}>
      {icon}
    </button>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="flex justify-center gap-2 mt-4">
      <button onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-border p-2 disabled:opacity-50">
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="flex items-center px-3 text-sm">{page + 1} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="rounded-lg border border-border p-2 disabled:opacity-50">
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}