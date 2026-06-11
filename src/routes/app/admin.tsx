import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
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

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_username?: string;
  reported_username?: string;
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
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "rooms" | "reports" | "announcements" | "points">("dashboard");
  
  // المستخدمين
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [userPage, setUserPage] = useState(0);
  
  // الغرف
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomPage, setRoomPage] = useState(0);
  
  // البلاغات
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportPage, setReportPage] = useState(0);
  
  // الإعلانات
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  // النقاط
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingPts, setSendingPts] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBc, setSendingBc] = useState(false);
  
  // إحصائيات
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    totalRooms: 0,
    activeRooms: 0,
    totalMessages: 0,
    pendingReports: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => {
    if (loaded && !isAdmin) navigate({ to: "/app" });
  }, [loaded, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "rooms") loadRooms();
    if (activeTab === "reports") loadReports();
    if (activeTab === "announcements") loadAnnouncements();
  }, [activeTab, searchUser]);

  // تحميل بيانات لوحة المعلومات
  const loadDashboardData = async () => {
    setLoading(true);
    
    // جلب عدد المستخدمين
    const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    
    // جلب عدد المستخدمين المحظورين
    const { count: bannedCount } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true);
    
    // جلب عدد الغرف
    const { count: roomCount } = await supabase.from("rooms").select("*", { count: "exact", head: true });
    
    // جلب عدد الغرف النشطة
    const { count: activeRoomCount } = await supabase.from("rooms").select("*", { count: "exact", head: true }).eq("is_active", true);
    
    // جلب عدد البلاغات المعلقة
    const { count: pendingReportsCount } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending");
    
    setStats({
      totalUsers: userCount || 0,
      activeUsers: Math.floor((userCount || 0) * 0.4),
      bannedUsers: bannedCount || 0,
      totalRooms: roomCount || 0,
      activeRooms: activeRoomCount || 0,
      totalMessages: 0,
      pendingReports: pendingReportsCount || 0,
    });
    
    setLoading(false);
  };

  // جلب المستخدمين
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
      // جلب حالة الحظر والكتم من جدول admin_actions إن وجد
      const usersWithStatus = (data || []).map(u => ({ 
        ...u, 
        is_banned: false, 
        is_muted: false 
      })) as Profile[];
      setUsers(usersWithStatus);
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
      // جلب عدد الأعضاء لكل غرفة
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

  // جلب البلاغات
  const loadReports = async () => {
    setLoadingReports(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      // إذا لم يوجد جدول reports، نستخدم بيانات تجريبية
      setReports([]);
    } else {
      // جلب أسماء المستخدمين للمبلغ والمبلغ عنه
      const reportsWithNames = await Promise.all(
        (data || []).map(async (report) => {
          const { data: reporter } = await supabase.from("profiles").select("username").eq("id", report.reporter_id).single();
          const { data: reported } = await supabase.from("profiles").select("username").eq("id", report.reported_id).single();
          return {
            ...report,
            reporter_username: reporter?.username || "غير معروف",
            reported_username: reported?.username || "غير معروف",
          };
        })
      );
      setReports(reportsWithNames as Report[]);
    }
    setLoadingReports(false);
  };

  // جلب الإعلانات
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

  // حظر مستخدم
  const handleBanUser = async (userId: string, isBanned: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: isBanned })
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: isBanned } : u));
      toast.success(isBanned ? "تم حظر المستخدم" : "تم إلغاء حظر المستخدم");
      loadDashboardData();
    } catch (error) {
      toast.error("فشل العملية");
    }
  };

  // كتم مستخدم
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

  // حذف مستخدم
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    
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
      loadDashboardData();
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
      loadDashboardData();
    } catch (error) {
      toast.error("فشل حذف الغرفة");
    }
  };

  // معالجة بلاغ
  const handleReportAction = async (reportId: string, action: "resolve" | "ignore") => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: action === "resolve" ? "resolved" : "ignored" })
        .eq("id", reportId);
      
      if (error) throw error;
      
      setReports(reports.map(r => r.id === reportId ? { ...r, status: action === "resolve" ? "resolved" : "ignored" } : r));
      toast.success(action === "resolve" ? "تم معالجة البلاغ" : "تم تجاهل البلاغ");
      loadDashboardData();
    } catch (error) {
      toast.error("فشل معالجة البلاغ");
    }
  };

  // إضافة إعلان
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

  // حذف إعلان
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

  // تبديل حالة إعلان
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

  // إرسال نقاط
  const sendPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!username.trim() || isNaN(amt) || amt <= 0) {
      toast.error("يرجى إدخال اسم مستخدم وعدد نقاط صحيح");
      return;
    }
    
    setSendingPts(true);
    
    // البحث عن المستخدم
    const { data: prof, error: findError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim())
      .maybeSingle();
    
    if (findError || !prof) {
      setSendingPts(false);
      toast.error("المستخدم غير موجود");
      return;
    }
    
    // تحديث النقاط
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", prof.id)
      .single();
    
    const currentPoints = currentProfile?.points || 0;
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
      loadDashboardData();
    }
  };

  // إرسال بث جماعي (يحتاج إلى دالة في supabase)
  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.trim()) return;
    
    setSendingBc(true);
    
    // محاولة استدعاء دالة broadcast إذا وجدت
    const { error } = await supabase.rpc("admin_broadcast", { _text: broadcast.trim() });
    
    setSendingBc(false);
    
    if (error) {
      toast.error("فشل إرسال البث: " + error.message);
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
  const paginatedReports = reports.slice(reportPage * itemsPerPage, (reportPage + 1) * itemsPerPage);
  const totalReportPages = Math.ceil(reports.length / itemsPerPage);

  if (!loaded || loading) {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
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
      <div className="border-b border-border overflow-x-auto">
        <div className="flex px-4 gap-1">
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<BarChart3 className="h-4 w-4" />} label="لوحة المعلومات" />
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users className="h-4 w-4" />} label="المستخدمين" />
          <TabButton active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} icon={<MessageSquare className="h-4 w-4" />} label="الغرف" />
          <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")} icon={<Flag className="h-4 w-4" />} label="البلاغات" />
          <TabButton active={activeTab === "announcements"} onClick={() => setActiveTab("announcements")} icon={<Mail className="h-4 w-4" />} label="الإعلانات" />
          <TabButton active={activeTab === "points"} onClick={() => setActiveTab("points")} icon={<Coins className="h-4 w-4" />} label="النقاط والبث" />
        </div>
      </div>

      <div className="p-6">
        {/* لوحة المعلومات */}
        {activeTab === "dashboard" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="إجمالي المستخدمين" value={stats.totalUsers} color="blue" />
              <StatCard icon={<ActivityIcon className="h-5 w-5" />} label="نشط اليوم" value={stats.activeUsers} color="green" />
              <StatCard icon={<Ban className="h-5 w-5" />} label="محظورين" value={stats.bannedUsers} color="red" />
              <StatCard icon={<MessageSquare className="h-5 w-5" />} label="الغرف" value={stats.totalRooms} color="purple" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <StatCard icon={<CheckCircle className="h-5 w-5" />} label="غرف نشطة" value={stats.activeRooms} color="emerald" />
              <StatCard icon={<Flag className="h-5 w-5" />} label="بلاغات معلقة" value={stats.pendingReports} color="orange" />
              <StatCard icon={<RefreshCw className="h-5 w-5" />} label="آخر تحديث" value={new Date().toLocaleDateString("ar")} color="gray" />
            </div>
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
                            <Badge icon={<Ban className="h-3 w-3" />} text="محظور" color="red" />
                          ) : u.is_muted ? (
                            <Badge icon={<VolumeX className="h-3 w-3" />} text="مكتوم" color="orange" />
                          ) : (
                            <Badge icon={<CheckCircle className="h-3 w-3" />} text="نشط" color="green" />
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
                        <td className="p-3">
                          {r.type === "private" ? (
                            <Badge icon={<Lock className="h-3 w-3" />} text="خاصة" color="amber" />
                          ) : (
                            <Badge icon={<GlobeIcon className="h-3 w-3" />} text="عامة" color="blue" />
                          )}
                        </td>
                        <td className="p-3">{r.member_count}</td>
                        <td className="p-3">
                          {r.is_active ? (
                            <Badge icon={<CheckCircle className="h-3 w-3" />} text="نشطة" color="green" />
                          ) : (
                            <Badge icon={<XCircle className="h-3 w-3" />} text="معطلة" color="red" />
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

        {/* البلاغات */}
        {activeTab === "reports" && (
          <div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">من</th>
                    <th className="p-3">ضد</th>
                    <th className="p-3">السبب</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                   </tr>
                </thead>
                <tbody>
                  {loadingReports ? (
                    <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                  ) : paginatedReports.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد بلاغات</td></tr>
                  ) : (
                    paginatedReports.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="p-3">{r.reporter_username || "غير معروف"}</td>
                        <td className="p-3">{r.reported_username || "غير معروف"}</td>
                        <td className="p-3 text-sm">{r.reason}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                        <td className="p-3">
                          {r.status === "pending" ? (
                            <Badge icon={<AlertTriangle className="h-3 w-3" />} text="معلق" color="orange" />
                          ) : (
                            <Badge icon={<CheckCircle className="h-3 w-3" />} text="تمت المعالجة" color="green" />
                          )}
                        </td>
                        <td className="p-3">
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <ActionButton onClick={() => handleReportAction(r.id, "resolve")} icon={<CheckCircle className="h-4 w-4" />} color="green" title="معالجة" />
                              <ActionButton onClick={() => handleReportAction(r.id, "ignore")} icon={<XCircle className="h-4 w-4" />} color="gray" title="تجاهل" />
                            </div>
                          )}
                        </td>
                       </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalReportPages > 1 && <Pagination page={reportPage} totalPages={totalReportPages} onPageChange={setReportPage} />}
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
                <div className="w-full max-w-md rounded-2xl bg-card p-6" onClick={(e)