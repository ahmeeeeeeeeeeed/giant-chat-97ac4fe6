import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ArrowRight, MessageCircle, Ban, Flag, Globe, Lock, EyeOff, Eye, Crown, Award } from "lucide-react";
import { getEquipped, type EquippedSet } from "@/lib/equipped";
import { BadgeChip } from "@/routes/app/store";

export const Route = createFileRoute("/profile/$id")({
  component: OtherProfilePage,
});

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  points: number;
  gender: "male" | "female" | null;
  country: string | null;
  hide_last_seen: boolean;
  dm_locked: boolean;
  last_seen_at: string | null;
  profile_views: number;
};

function getUserLevel(points: number) {
  if (points >= 100000) return { label: "أسطورة", color: "#9333EA" };
  if (points >= 50000)  return { label: "خبير", color: "#2563EB" };
  if (points >= 25000)  return { label: "محترف", color: "#0891B2" };
  if (points >= 10000)  return { label: "شخصية مهمة", color: "#DC2626" };
  if (points >= 5000)   return { label: "نشيط", color: "#16A34A" };
  if (points >= 1000)   return { label: "متقدم", color: "#CA8A04" };
  return { label: "مبتدئ", color: "#6B7280" };
}

function OtherProfilePage() {
  const { id: otherId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [equipped, setEquipped] = useState<EquippedSet>({});

  // للتصحيح: طباعة الـ ID
  console.log("OtherProfilePage - otherId:", otherId);
  console.log("OtherProfilePage - user:", user?.id);

  useEffect(() => {
    if (!user) {
      console.log("لا يوجد مستخدم مسجل دخول");
      setError("يرجى تسجيل الدخول");
      setLoading(false);
      return;
    }
    
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      
      console.log("جاري جلب بيانات المستخدم:", otherId);
      
      // جلب بيانات البروفايل
      const { data: p, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, points, gender, country, hide_last_seen, dm_locked, last_seen_at, profile_views")
        .eq("id", otherId)
        .maybeSingle();
      
      console.log("نتيجة جلب البروفايل:", { data: p, error: profileError });
      
      if (profileError) {
        console.error("خطأ في جلب البروفايل:", profileError);
        setError(`خطأ في قاعدة البيانات: ${profileError.message}`);
        setLoading(false);
        return;
      }
      
      if (!p) {
        console.log("المستخدم غير موجود في قاعدة البيانات");
        setError("المستخدم غير موجود");
        toast.error("المستخدم غير موجود");
        setLoading(false);
        setTimeout(() => navigate({ to: "/app/chats" }), 1500);
        return;
      }
      
      setProfile(p as Profile);
      console.log("تم تعيين البروفايل:", p);

      // جلب الشارات المجهزة
      try {
        const eq = await getEquipped(otherId);
        setEquipped(eq);
      } catch (eqErr) {
        console.error("خطأ في جلب الشارات:", eqErr);
      }

      // جلب حالة الحظر
      try {
        const [{ data: blockMe }, { data: blockByMe }] = await Promise.all([
          supabase.from("dm_blocks").select("blocker_id").eq("blocker_id", otherId).eq("blocked_id", user.id).maybeSingle(),
          supabase.from("dm_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", otherId).maybeSingle(),
        ]);
        setIsBlockedBy(!!blockMe);
        setIsBlocked(!!blockByMe);
        console.log("حالة الحظر:", { isBlockedBy: !!blockMe, isBlocked: !!blockByMe });
      } catch (blockErr) {
        console.error("خطأ في جلب حالة الحظر:", blockErr);
      }
      
      setLoading(false);
    };

    fetchProfile();
  }, [otherId, user, navigate]);

  const handleSendMessage = () => {
    navigate({ to: "/app/chats/$id", params: { id: otherId } });
  };

  const handleBlock = async () => {
    if (!user) return;
    if (isBlocked) {
      const { error } = await supabase
        .from("dm_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", otherId);
      if (error) toast.error("حدث خطأ");
      else {
        setIsBlocked(false);
        toast.success("تم إلغاء حظر المستخدم");
      }
    } else {
      if (!confirm("هل تريد حظر هذا المستخدم؟")) return;
      const { error } = await supabase
        .from("dm_blocks")
        .insert({ blocker_id: user.id, blocked_id: otherId });
      if (error) toast.error("حدث خطأ");
      else {
        setIsBlocked(true);
        toast.success("تم حظر المستخدم");
      }
    }
  };

  const handleReport = () => {
    toast.success("تم إرسال البلاغ للإدارة");
  };

  const formatLastSeen = () => {
    if (!profile) return "";
    if (profile.hide_last_seen) return "آخر ظهور مخفي";
    if (!profile.last_seen_at) return "غير متصل";
    const diff = (Date.now() - new Date(profile.last_seen_at).getTime()) / 1000;
    if (diff < 60) return "متصل الآن";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return `منذ ${Math.floor(diff / 86400)} يوم`;
  };

  // عرض رسالة الخطأ إذا وجدت
  if (error) {
    return (
      <main className="flex flex-1 flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <button
            onClick={() => navigate({ to: "/app/chats" })}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-5 w-5" />
            <span>الرجوع للمحادثات</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={() => navigate({ to: "/app/chats" })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              العودة للمحادثات
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex flex-1 flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <button
            onClick={() => navigate({ to: "/app/chats" })}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-5 w-5" />
            <span>الرجوع للمحادثات</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">لا توجد بيانات للمستخدم</p>
        </div>
      </main>
    );
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <button
          onClick={() => navigate({ to: "/app/chats" })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
          <span>الرجوع للمحادثات</span>
        </button>
      </header>

      <div className="flex-1 px-5 py-6">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-primary text-4xl font-bold text-primary-foreground ring-4 ring-background shadow-xl">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  {profile.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-extrabold">{profile.username}</h1>
            
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                🪙 {profile.points} نقطة
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {formatLastSeen()}
              </span>
            </div>

            {profile.bio && (
              <p className="mt-4 max-w-md text-sm text-muted-foreground">{profile.bio}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {profile.gender && (
                <span className="text-sm text-muted-foreground">
                  {profile.gender === "male" ? "♂ ذكر" : "♀ أنثى"}
                </span>
              )}
              {profile.country && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  {profile.country}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              {profile.dm_locked && (
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  الرسائل مقفولة
                </span>
              )}
              {profile.hide_last_seen && (
                <span className="flex items-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  يخفي آخر ظهور
                </span>
              )}
            </div>

            {!isOwnProfile && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleSendMessage}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg transition active:scale-95"
                >
                  <MessageCircle className="h-5 w-5" />
                  إرسال رسالة
                </button>
                
                <button
                  onClick={handleBlock}
                  className={`flex h-11 items-center justify-center gap-2 rounded-2xl border px-6 font-semibold transition active:scale-95 ${
                    isBlocked
                      ? "border-green-500 bg-green-500/10 text-green-500"
                      : "border-destructive/50 bg-destructive/10 text-destructive"
                  }`}
                >
                  <Ban className="h-5 w-5" />
                  {isBlocked ? "إلغاء الحظر" : "حظر"}
                </button>

                <button
                  onClick={handleReport}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 font-semibold transition active:scale-95"
                >
                  <Flag className="h-5 w-5" />
                  إبلاغ
                </button>
              </div>
            )}

            {isBlockedBy && !isOwnProfile && (
              <div className="mt-4 rounded-2xl bg-destructive/10 p-3 text-center text-sm text-destructive">
                ⚠️ هذا المستخدم قام بحظرك. لا يمكنك إرسال رسائل له.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}