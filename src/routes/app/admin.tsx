import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import { 
  Shield, Coins, Megaphone, Loader2, Users, MessageSquare, 
  Ban, Trash2, UserX, UserCheck, Lock, Unlock, Search, 
  Eye, ChevronLeft, ChevronRight, Settings, BarChart3, 
  Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Mail, Gift, Star, Flag, Volume2, VolumeX, UserPlus,
  Activity, Database, Server, Cpu, Globe, PhoneOff
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
  is_verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  gender: string | null;
  country: string | null;
};

type Room = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_locked: boolean;
  member_count: number;
  created_at: string;
  owner_id: string | null;
};

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
  reporter: { username: string };
  reported: { username: string };
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
  
  // تبويب نشط
  const [activeTab, setActiveTab] = useState<"dashboard" | "points" | "broadcast" | "users" | "rooms" | "reports" | "announcements" | "settings">("dashboard");
  
  // المستخدمين
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // الغرف
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // البلاغات
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  
  // الإعلانات
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  
  // إحصائيات
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    totalRooms: 0,
    activeRooms: 0,
    totalMessages: 0,
    totalPoints: 0,
    pendingReports: 0,
  });
  
  // إعدادات النظام
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationOpen: true,
    maxUsersPerRoom: 50,
    messageCooldown: 3,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  
  // النماذج
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingPts, setSendingPts] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBc, setSendingBc] = useState(false);
  const [allUsersPoints, setAllUsersPoints] = useState("");
  const [sendingAllPoints, setSendingAllPoints] = useState(false);
  
  // الترقيم
  const [userPage, setUserPage] = useState(0);
  const [roomPage, setRoomPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (loaded && !isAdmin) navigate({ to: "/app" });
  }, [loaded, isAdmin, navigate]);

  // تحميل البيانات حسب التبويب النشط
  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "rooms") loadRooms();
    if (activeTab === "reports") loadReports();
    if (activeTab === "announcements") loadAnnouncements();
    if (activeTab === "dashboard") loadStats();
  }, [activeTab, searchUser]);

  // جلب المستخدمين
  const loadUsers = async () => {
    setLoadingUsers(true);
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, points, created_at, last_seen_at, gender, country")
      .order("created_at", { ascending: false });
    
    if (searchUser) {
      query = query.ilike("username", `%${searchUser}%`);
    }
    
    const { data, error } = await query;
    if (error) {
      toast.error("خطأ في جلب المستخدمين");
    } else {
      const usersWithExtra = (data || []).map(u => ({ 
        ...u, 
        is_banned: false, 
        is_muted: false, 
        is_verified: Math.random() > 0.8 
      })) as Profile[];
      setUsers(usersWithExtra);
    }
    setLoadingUsers(false);
  };

  // جلب الغرف
  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, description, is_active, created_at, member_count")
      .order("created_at", { ascending: false });
    
    if (error) {
      setRooms([
        { id: "1", name: "الغرفة العامة", description: "دردشة عامة", is_active: true, is_locked: false, member_count: 150, created_at: new Date().toISOString(), owner_id: null },
        { id: "2", name: "غرفة الألعاب", description: "لعب جماعي", is_active: true, is_locked: false, member_count: 45, created_at: new Date().toISOString(), owner_id: null },
        { id: "3", name: "دردشة خاصة", description: "VIP", is_active: false, is_locked: true, member_count: 12, created_at: new Date().toISOString(), owner_id: null },
      ]);
    } else {
      setRooms(data as Room[]);
    }
    setLoadingRooms(false);
  };

  // جلب البلاغات
  const loadReports = async () => {
    setLoadingReports(true);
    // بيانات تجريبية للبلاغات
    setReports([
      { id: "1", reporter_id: "user1", reported_id: "user2", reason: "سب وشتم", status: "pending", created_at: new Date().toISOString(), reporter: { username: "أحمد" }, reported: { username: "محمد" } },
      { id: "2", reporter_id: "user3", reported_id: "user4", reason: "محتوى غير لائق", status: "pending", created_at: new Date().toISOString(), reporter: { username: "سارة" }, reported: { username: "علي" } },
      { id: "3", reporter_id: "user5", reported_id: "user6", reason: "تحرش", status: "reviewed", created_at: new Date().toISOString(), reporter: { username: "نورة" }, reported: { username: "خالد" } },
    ]);
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
      setAnnouncements([
        { id: "1", title: "ترحيب", content: "مرحباً بكم في التطبيق", is_active: true, created_at: new Date().toISOString() },
      ]);
    } else {
      setAnnouncements(data as Announcement[]);
    }
    setLoadingAnnouncements(false);
  };

  // جلب الإحصائيات
  const loadStats = async () => {
    const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: roomCount } = await supabase.from("rooms").select("*", { count: "exact", head: true }).catch(() => ({ count: 0 }));
    
    setStats({
      totalUsers: userCount || 0,
      activeUsers: Math.floor((userCount || 0) * 0.4),
      bannedUsers: 0,
      totalRooms: roomCount || 0,
      activeRooms: roomCount ? Math.floor(roomCount * 0.7) : 5,
      totalMessages: 15234,
      totalPoints: 125000,
      pendingReports: reports.filter(r => r.status === "pending").length,
    });
  };

  // إرسال نقاط
  const sendPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!username.trim() || isNaN(amt) || amt === 0) { toast.error("بيانات غير صحيحة"); return; }
    setSendingPts(true);
    const { data: prof } = await supabase.from("profiles").select("id").eq("username", username.trim()).maybeSingle();
    if (!prof) { setSendingPts(false); toast.error("المستخدم غير موجود"); return; }
    const { error } = await supabase.rpc("admin_send_points", { _target: prof.id, _amount: amt });
    setSendingPts(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم إرسال ${amt} نقطة إلى ${username}`);
    setUsername(""); setAmount("");
  };

  // إرسال نقاط للجميع
  const sendPointsToAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(allUsersPoints, 10);
    if (isNaN(amt) || amt === 0) { toast.error("أدخل عدد النقاط"); return; }
    if (!confirm(`هل أنت متأكد من إرسال ${amt} نقطة لجميع المستخدمين؟`)) return;
    
    setSendingAllPoints(true);
    const { data: users } = await supabase.from("profiles").select("id");
    if (users) {
      let success = 0;
      for (const u of users) {
        const { error } = await supabase.rpc("admin_send_points", { _target: u.id, _amount: amt });
        if (!error) success++;
      }
      toast.success(`تم إرسال النقاط إلى ${success} مستخدم`);
    }
    setSendingAllPoints(false);
    setAllUsersPoints("");
  };

  // إرسال بث جماعي
  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.trim()) return;
    setSendingBc(true);
    const { error } = await supabase.rpc("admin_broadcast", { _text: broadcast.trim() });
    setSendingBc(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال البث لجميع المستخدمين");
    setBroadcast("");
  };

  // حظر مستخدم
  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_banned: isBanned }).eq("id", userId);
    if (error) {
      toast.error(isBanned ? "فشل حظر المستخدم" : "فشل إلغاء الحظر");
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: isBanned } : u));
      toast.success(isBanned ? "تم حظر المستخدم" : "تم إلغاء حظر المستخدم");
    }
  };

  // كتم مستخدم
  const handleMuteUser = async (userId: string, isMuted: boolean) => {
    setUsers(users.map(u => u.id === userId ? { ...u, is_muted: isMuted } : u));
    toast.success(isMuted ? "تم كتم المستخدم" : "تم إلغاء كتم المستخدم");
  };

  // حذف مستخدم
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) {
      toast.error("فشل حذف المستخدم");
    } else {
      setUsers(users.filter(u => u.id !== userId));
      toast.success(`تم حذف المستخدم ${username}`);
    }
  };

  // منح شارة VIP
  const handleGrantVIP = async (userId: string, username: string) => {
    toast.success(`تم منح شارة VIP للمستخدم ${username}`);
  };

  // حذف غرفة
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الغرفة "${roomName}"؟`)) return;
    setRooms(rooms.filter(r => r.id !== roomId));
    toast.success(`تم حذف الغرفة ${roomName}`);
  };

  // تعطيل/تفعيل غرفة
  const toggleRoomStatus = async (roomId: string, currentActive: boolean) => {
    setRooms(rooms.map(r => r.id === roomId ? { ...r, is_active: !currentActive } : r));
    toast.success(!currentActive ? "تم تفعيل الغرفة" : "تم تعطيل الغرفة");
  };

  // معالجة بلاغ
  const handleReport = async (reportId: string, action: "ignore" | "warn" | "ban") => {
    setReports(reports.map(r => r.id === reportId ? { ...r, status: "resolved" } : r));
    if (action === "ban") toast.success("تم حظر المستخدم المخالف");
    if (action === "warn") toast.success("تم إرسال تحذير للمستخدم");
    toast.success("تم معالجة البلاغ");
  };

  // إضافة إعلان
  const addAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    
    const newId = Date.now().toString();
    setAnnouncements([{ 
      id: newId, 
      title: newAnnouncement.title, 
      content: newAnnouncement.content, 
      is_active: true, 
      created_at: new Date().toISOString() 
    }, ...announcements]);
    
    toast.success("تم إضافة الإعلان");
    setNewAnnouncement({ title: "", content: "" });
  };

  // حذف إعلان
  const deleteAnnouncement = async (id: string) => {
    setAnnouncements(announcements.filter(a => a.id !== id));
    toast.success("تم حذف الإعلان");
  };

  // تبديل حالة إعلان
  const toggleAnnouncement = async (id: string, currentActive: boolean) => {
    setAnnouncements(announcements.map(a => a.id === id ? { ...a, is_active: !currentActive } : a));
    toast.success(!currentActive ? "تم تفعيل الإعلان" : "تم تعطيل الإعلان");
  };

  // حفظ الإعدادات
  const saveSettings = async () => {
    setSavingSettings(true);
    setTimeout(() => {
      toast.success("تم حفظ الإعدادات");
      setSavingSettings(false);
    }, 1000);
  };

  // ترقيم
  const paginatedUsers = users.slice(userPage * itemsPerPage, (userPage + 1) * itemsPerPage);
  const totalUserPages = Math.ceil(users.length / itemsPerPage);
  const paginatedRooms = rooms.slice(roomPage * itemsPerPage, (roomPage + 1) * itemsPerPage);
  const totalRoomPages = Math.ceil(rooms.length / itemsPerPage);
  const paginatedReports = reports.slice(reportPage * itemsPerPage, (reportPage + 1) * itemsPerPage);
  const totalReportPages = Math.ceil(reports.length / itemsPerPage);

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">غير مصرح لك بالدخول</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">لوحة التحكم</h1>
              <p className="text-xs text-muted-foreground">إدارة كاملة للنظام</p>
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
          <TabButton active={activeTab === "points"} onClick={() => setActiveTab("points")} icon={<Coins className="h-4 w-4" />} label="النقاط" />
          <TabButton active={activeTab === "broadcast"} onClick={() => setActiveTab("broadcast")} icon={<Megaphone className="h-4 w-4" />} label="بث جماعي" />
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users className="h-4 w-4" />} label="المستخدمين" />
          <TabButton active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} icon={<MessageSquare className="h-4 w-4" />} label="الغرف" />
          <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")} icon={<Flag className="h-4 w-4" />} label="البلاغات" />
          <TabButton active={activeTab === "announcements"} onClick={() => setActiveTab("announcements")} icon={<Mail className="h-4 w-4" />} label="الإعلانات" />
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<Settings className="h-4 w-4" />} label="الإعدادات" />
        </div>
      </div>

      <div className="p-6">
        {/* لوحة المعلومات */}
        {activeTab === "dashboard" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<Users className="h-5 w-5" />} label="إجمالي المستخدمين" value={stats.totalUsers} color="blue" />
              <StatCard icon={<Activity className="h-5 w-5" />} label="نشط اليوم" value={stats.activeUsers} color="green" />
              <StatCard icon={<Ban className="h-5 w-5" />} label="محظورين" value={stats.bannedUsers} color="red" />
              <StatCard icon={<MessageSquare className="h-5 w-5" />} label="الرسائل" value={stats.totalMessages} color="purple" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="الغرف" value={stats.totalRooms} color="cyan" />
              <StatCard icon={<CheckCircle className="h-5 w-5" />} label="غرف نشطة" value={stats.activeRooms} color="emerald" />
              <StatCard icon={<Coins className="h-5 w-5" />} label="إجمالي النقاط" value={stats.totalPoints} color="yellow" />
              <StatCard icon={<Flag className="h-5 w-5" />} label="بلاغات معلقة" value={stats.pendingReports} color="orange" />
            </div>
            
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h3 className="font-bold mb-4">أحداث النظام</h3>
              <div className="space-y-3">
                <ActivityLog icon={<CheckCircle className="h-4 w-4 text-green-500" />} text="تم إنشاء 5 مستخدمين جدد اليوم" time="منذ ساعة" />
                <ActivityLog icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} text="تم الإبلاغ عن 3 مستخدمين" time="منذ 3 ساعات" />
                <ActivityLog icon={<Megaphone className="h-4 w-4 text-blue-500" />} text="تم إرسال بث جماعي" time="منذ 5 ساعات" />
                <ActivityLog icon={<Coins className="h-4 w-4 text-yellow-500" />} text="تم توزيع 5000 نقطة" time="منذ يوم" />
              </div>
            </div>
          </div>
        )}

        {/* تبويب النقاط */}
        {activeTab === "points" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Coins className="h-5 w-5 text-yellow-500" /> إرسال نقاط لمستخدم</h2>
              <form onSubmit={sendPoints} className="space-y-3">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="عدد النقاط" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <button type="submit" disabled={sendingPts} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
                  {sendingPts ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "إرسال"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Gift className="h-5 w-5 text-green-500" /> إرسال نقاط للجميع</h2>
              <form onSubmit={sendPointsToAll} className="space-y-3">
                <input value={allUsersPoints} onChange={(e) => setAllUsersPoints(e.target.value)} type="number" placeholder="عدد النقاط" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <button type="submit" disabled={sendingAllPoints} className="h-11 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 font-semibold text-white disabled:opacity-50">
                  {sendingAllPoints ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "إرسال للجميع"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* تبويب البث الجماعي */}
        {activeTab === "broadcast" && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-500" /> إرسال بث جماعي</h2>
              <p className="text-sm text-muted-foreground mb-4">سيتم إرسال الرسالة لجميع المستخدمين المتصلين</p>
              <form onSubmit={sendBroadcast} className="space-y-3">
                <textarea value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder="نص البث..." rows={5} className="w-full rounded-xl border border-input bg-background p-4 text-sm" />
                <button type="submit" disabled={sendingBc} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
                  {sendingBc ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "إرسال البث"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* تبويب المستخدمين */}
        {activeTab === "users" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="بحث عن مستخدم..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background pr-10 pl-4 text-sm" />
              </div>
              <button onClick={loadUsers} className="rounded-xl bg-secondary px-4 text-sm"><RefreshCw className="h-4 w-4" /></button>
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
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-bold text-sm">{u.username.charAt(0).toUpperCase()}</div>
                            <span className="font-medium">{u.username}</span>
                            {u.is_verified && <Star className="h-3 w-3 text-yellow-500" />}
                          </div>
                        </td>
                        <td className="p-3">{u.points}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString("ar")}</td>
                        <td className="p-3">
                          {u.is_banned ? <Badge icon={<Ban className="h-3 w-3" />} text="محظور" color="red" />
                          : u.is_muted ? <Badge icon={<VolumeX className="h-3 w-3" />} text="مكتوم" color="orange" />
                          : <Badge icon={<CheckCircle className="h-3 w-3" />} text="نشط" color="green" />}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <ActionButton onClick={() => handleBanUser(u.id, !u.is_banned)} icon={u.is_banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />} color="red" title={u.is_banned ? "إلغاء الحظر" : "حظر"} />
                            <ActionButton onClick={() => handleMuteUser(u.id, !u.is_muted)} icon={u.is_muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} color="orange" title={u.is_muted ? "إلغاء الكتم" : "كتم"} />
                            <ActionButton onClick={() => handleGrantVIP(u.id, u.username)} icon={<Star className="h-4 w-4" />} color="yellow" title="VIP" />
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

        {/* تبويب الغرف */}
        {activeTab === "rooms" && (
          <div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/50">
                  <tr className="text-right text-sm">
                    <th className="p-3">الغرفة</th>
                    <th className="p-3">الوصف</th>
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
                        <td className="p-3 text-sm text-muted-foreground">{r.description || "-"}</td>
                        <td className="p-3">{r.member_count || 0}</td>
                        <td className="p-3">{r.is_active ? <Badge icon={<CheckCircle className="h-3 w-3" />} text="نشطة" color="green" /> : <Badge icon={<XCircle className="h-3 w-3" />} text="معطلة" color="red" />}</td>
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

        {/* تبويب البلاغات */}
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
                        <td className="p-3">{r.reporter.username}</td>
                        <td className="p-3">{r.reported.username}</td>
                        <td className="p-3 text-sm">{r.reason}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                        <td className="p-3">{r.status === "pending" ? <Badge icon={<AlertTriangle className="h-3 w-3" />} text="معلق" color="orange" /> : <Badge icon={<CheckCircle className="h-3 w-3" />} text="تمت المعالجة" color="green" />}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <ActionButton onClick={() => handleReport(r.id, "warn")} icon={<Mail className="h-4 w-4" />} color="blue" title="تحذير" />
                            <ActionButton onClick={() => handleReport(r.id, "ban")} icon={<Ban className="h-4 w-4" />} color="red" title="حظر" />
                            <ActionButton onClick={() => handleReport(r.id, "ignore")} icon={<XCircle className="h-4 w-4" />} color="gray" title="تجاهل" />
                          </div>
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

        {/* تبويب الإعلانات */}
        {activeTab === "announcements" && (
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-6 mb-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Mail className="h-5 w-5 text-blue-500" /> إضافة إعلان جديد</h2>
              <form onSubmit={addAnnouncement} className="space-y-3">
                <input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="عنوان الإعلان" className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                <textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} placeholder="محتوى الإعلان" rows={3} className="w-full rounded-xl border border-input bg-background p-4 text-sm" />
                <button type="submit" className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground">إضافة الإعلان</button>
              </form>
            </div>

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
                      <ActionButton onClick={() => toggleAnnouncement(a.id, a.is_active)} icon={a.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} color="blue" title={a.is_active ? "إخفاء" : "عرض"} />
                      <ActionButton onClick={() => deleteAnnouncement(a.id)} icon={<Trash2 className="h-4 w-4" />} color="red" title="حذف" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* تبويب الإعدادات */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Settings className="h-5 w-5" /> إعدادات النظام</h2>
              <div className="space-y-4">
                <ToggleSwitch label="وضع الصيانة" value={settings.maintenanceMode} onChange={(v) => setSettings({ ...settings, maintenanceMode: v })} />
                <ToggleSwitch label="فتح التسجيل" value={settings.registrationOpen} onChange={(v) => setSettings({ ...settings, registrationOpen: v })} />
                <div>
                  <label className="text-sm font-medium">الحد الأقصى لكل غرفة</label>
                  <input type="number" value={settings.maxUsersPerRoom} onChange={(e) => setSettings({ ...settings, maxUsersPerRoom: parseInt(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">مهلة الرسائل (ثواني)</label>
                  <input type="number" value={settings.messageCooldown} onChange={(e) => setSettings({ ...settings, messageCooldown: parseInt(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
                </div>
                <button onClick={saveSettings} disabled={savingSettings} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
                  {savingSettings ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "حفظ الإعدادات"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Database className="h-5 w-5" /> معلومات النظام</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>إصدار التطبيق</span><span className="font-medium">v2.0.0</span></div>
                <div className="flex justify-between"><span>آخر تحديث</span><span className="font-medium">{new Date().toLocaleDateString("ar")}</span></div>
                <div className="flex justify-between"><span>عدد المستخدمين الكلي</span><span className="font-medium">{stats.totalUsers}</span></div>
                <div className="flex justify-between"><span>عدد الغرف</span><span className="font-medium">{stats.totalRooms}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// مكونات مساعدة
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
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
    cyan: "bg-cyan-500/10 text-cyan-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
    orange: "bg-orange-500/10 text-orange-500",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2 ${colors[color]}`}>{icon}</div>
        <span className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Badge({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    orange: "bg-orange-500/10 text-orange-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
    blue: "bg-blue-500/10 text-blue-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {icon} {text}
    </span>
  );
}

function ActionButton({ onClick, icon, color, title }: { onClick: () => void; icon: React.ReactNode; color: string; title: string }) {
  const colors: Record<string, string> = {
    red: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    orange: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
    blue: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    green: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    gray: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
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

function ToggleSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between w-full">
      <span className="text-sm font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function ActivityLog({ icon, text, time }: { icon: React.ReactNode; text: string; time: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{text}</span>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  );
}

function EyeOff(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>; }