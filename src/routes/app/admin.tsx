import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { 
  Shield, Coins, Megaphone, Loader2, Users, MessageSquare, 
  Ban, Trash2, UserX, UserCheck, Lock, Unlock, Search, 
  Eye, ChevronLeft, ChevronRight, Settings, BarChart3, 
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Mail, Gift, Star, Flag, Volume2, VolumeX, Plus, X, Edit
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
  is_banned: boolean;
  is_muted: boolean;
  created_at: string;
  last_seen_at: string | null;
};

type Room = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "rooms" | "announcements" | "points">("dashboard");
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
  
  // الإعلانات
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
  
  // النقاط والبث
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingPts, setSendingPts] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBc, setSendingBc] = useState(false);
  
  // إحصائيات
  const [stats, setStats] = useState({
    totalUsers: 0,
    bannedUsers: 0,
    totalRooms: 0,
    activeRooms: 0,
    pendingReports: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  // التحقق من صلاحيات الأدمن
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      
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

  // تحميل البيانات
  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
      if (activeTab === "users") loadUsers();
      if (activeTab === "rooms") loadRooms();
      if (activeTab === "announcements") loadAnnouncements();
    }
  }, [isAdmin, activeTab, searchUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: roomCount } = await supabase.from("rooms").select("*", { count: "exact", head: true });
    const { count: activeRoomCount } = await supabase.from("rooms").select("*", { count: "exact", head: true }).eq("is_active", true);
    
    setStats({
      totalUsers: userCount || 0,
      bannedUsers: 0,
      totalRooms: roomCount || 0,
      activeRooms: activeRoomCount || 0,
      pendingReports: 0,
    });
    
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, points, created_at, last_seen_at")
      .order("created_at", { ascending: false });
    
    if (searchUser) {
      query = query.ilike("username", `%${searchUser}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      toast.error("خطأ في جلب المستخدمين");
    } else {
      const usersWithStatus = (data || []).map(u => ({ 
        ...u, 
        is_banned: false, 
        is_muted: false 
      })) as Profile[];
      setUsers(usersWithStatus);
    }
    setLoadingUsers(false);
  };

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
      const roomsWithCount = await Promise.all(
        (data || []).map(async (room) => {
          const { count } = await supabase
            .from("room_members")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id);
          return { ...room, member_count: count || 0 };
        })
      );
      setRooms(roomsWithCount as Room[]);
    }
    setLoadingRooms(false);
  };

  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      setAnnouncements([]);
    } else {
      setAnnouncements(data as Announcement[]);
    }
    setLoadingAnnouncements(false);
  };

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
      toast.error("فشل العملية");
    }
  };

  const handleMuteUser = async (userId: string, isMuted: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_muted: isMuted })
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, is_muted: isMuted } : u));
      toast.success(isMuted ? "تم كتم المستخدم" : "تم إلغاء كتم المستخدم");
    } catch (error) {
      toast.error("فشل العملية");
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`)) return;
    
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      
      setUsers(users.filter(u => u.id !== userId));
      toast.success(`تم حذف المستخدم ${username}`);
      loadDashboardData();
    } catch (error) {
      toast.error("فشل حذف المستخدم");
    }
  };

  const toggleRoomStatus = async (roomId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ is_active: !currentActive })
        .eq("id", roomId);
      
      if (error) throw error;
      
      setRooms(rooms.map(r => r.id === roomId ? { ...r, is_active: !currentActive } : r));
      toast.success(!currentActive ? "تم تفعيل الغرفة" : "تم تعطيل الغرفة");
      loadDashboardData();
    } catch (error) {
      toast.error("فشل تغيير حالة الغرفة");
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الغرفة "${roomName}"؟`)) return;
    
    try {
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);
      if (error) throw error;
      
      setRooms(rooms.filter(r => r.id !== roomId));
      toast.success(`تم حذف الغرفة ${roomName}`);
      loadDashboardData();
    } catch (error) {
      toast.error("فشل حذف الغرفة");
    }
  };

  const addAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast.error("يرجى إدخال عنوان ومحتوى الإعلان");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title: newAnnouncement.title.trim(),
          content: newAnnouncement.content.trim(),
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setAnnouncements([data, ...announcements]);
      setNewAnnouncement({ title: "", content: "" });
      setShowAddAnnouncement(false);
      toast.success("تم إضافة الإعلان");
    } catch (error) {
      toast.error("فشل إضافة الإعلان");
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الإعلان؟")) return;
    
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.success("تم حذف الإعلان");
    } catch (error) {
      toast.error("فشل حذف الإعلان");
    }
  };

  const toggleAnnouncementStatus = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_active: !currentActive })
        .eq("id", id);
      
      if (error) throw error;
      
      setAnnouncements(announcements.map(a => a.id === id ? { ...a, is_active: !currentActive } : a));
      toast.success(!currentActive ? "تم تفعيل الإعلان" : "تم تعطيل الإعلان");
    } catch (error) {
      toast.error("فشل تغيير حالة الإعلان");
    }
  };

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

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.trim()) return;
    
    setSendingBc(true);
    
    const { error } = await supabase
      .from("announcements")
      .insert({
        title: "بث إداري",
        content: broadcast.trim(),
        is_active: true,
      });
    
    setSendingBc(false);
    
    if (error) {
      toast.error("فشل إرسال البث: " + error.message);
    } else {
      toast.success("تم إرسال البث لجميع المستخدمين");
      setBroadcast("");
      loadAnnouncements();
    }
  };

  const paginatedUsers = users.slice(userPage * itemsPerPage, (userPage + 1) * itemsPerPage);
  const totalUserPages = Math.ceil(users.length / itemsPerPage);
  const paginatedRooms = rooms.slice(roomPage * itemsPerPage, (roomPage + 1) * itemsPerPage);
  const totalRoomPages = Math.ceil(rooms.length / itemsPerPage);

  if (loadingAuth || loading) {
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
              <p className="text-xs text-muted-foreground">إدارة كاملة للمستخدمين والغرف</p>
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
        <div className="flex px-4 gap-1 overflow-x-auto">
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<BarChart3 className="h-4 w-4" />} label="لوحة المعلومات" />
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users className="h-4 w-4" />} label="المستخدمين" />
          <TabButton active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} icon={<MessageSquare className="h-4 w-4" />} label="الغرف" />
          <TabButton active={activeTab === "announcements"} onClick={() => setActiveTab("announcements")} icon={<Mail className="h-4 w-4" />} label="الإعلانات" />
          <TabButton active={activeTab === "points"} onClick={() => setActiveTab("points")} icon={<Coins className="h-4 w-4" />} label="نقاط وبث" />
        </div>
      </div>

      <div className="p-6">
        {/* لوحة المعلومات */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="h-5 w-5" />} label="إجمالي المستخدمين" value={stats.totalUsers} color="blue" />
            <StatCard icon={<Ban className="h-5 w-5" />} label="محظورين" value={stats.bannedUsers} color="red" />
            <StatCard icon={<MessageSquare className="h-5 w-5" />} label="الغرف" value={stats.totalRooms} color="purple" />
            <StatCard icon={<CheckCircle className="h-5 w-5" />} label="غرف نشطة" value={stats.activeRooms} color="green" />
          </div>
        )}

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
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد مستخدمين</td></tr>
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
                          {u.is_banned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">محظور</span>
                          ) : u.is_muted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-500">مكتوم</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500">نشط</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <ActionButton onClick={() => handleBanUser(u.id, !u.is_banned)} icon={u.is_banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />} color="red" title={u.is_banned ? "إلغاء الحظر" : "حظر"} />
                            <ActionButton onClick={() => handleMuteUser(u.id, !u.is_muted)} icon={u.is_muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} color="orange" title={u.is_muted ? "إلغاء الكتم" : "كتم"} />
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
                    <th className="p-3">الأعضاء</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingRooms ? (
                    <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : paginatedRooms.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد غرف</td></tr>
                  ) : (
                    paginatedRooms.map((r) => (
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
                          <div className="flex gap-1">
                            <ActionButton onClick={() => toggleRoomStatus(r.id, r.is_active)} icon={r.is_active ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />} color="blue" title={r.is_active ? "تعطيل" : "تفعيل"} />
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

        {/* الإعلانات */}
        {activeTab === "announcements" && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4">
              <button
                onClick={() => setShowAddAnnouncement(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                إضافة إعلان جديد
              </button>
            </div>

            {showAddAnnouncement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddAnnouncement(false)}>
                <div className="w-full max-w-md rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold mb-4">إضافة إعلان جديد</h3>
                  <input
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    placeholder="العنوان"
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm mb-3"
                  />
                  <textarea
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    placeholder="المحتوى"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={addAnnouncement} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">إضافة</button>
                    <button onClick={() => setShowAddAnnouncement(false)} className="flex-1 rounded-lg border border-border py-2 text-sm">إلغاء</button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{a.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{a.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString("ar")}</p>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton onClick={() => toggleAnnouncementStatus(a.id, a.is_active)} icon={a.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} color="blue" title={a.is_active ? "إخفاء" : "عرض"} />
                      <ActionButton onClick={() => deleteAnnouncement(a.id)} icon={<Trash2 className="h-4 w-4" />} color="red" title="حذف" />
                    </div>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <p className="text-center text-muted-foreground py-8">لا توجد إعلانات</p>
              )}
            </div>
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2 ${colors[color]}`}>{icon}</div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionButton({ onClick, icon, color, title }: { onClick: () => void; icon: React.ReactNode; color: string; title: string }) {
  const colors: Record<string, string> = {
    red: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    orange: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    blue: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    green: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  };
  return (
    <button onClick={onClick} className={`rounded-lg p-1.5 transition ${colors[color]}`} title={title}>
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

function EyeOff(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}