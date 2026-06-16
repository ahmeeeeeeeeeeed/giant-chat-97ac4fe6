import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ArrowRight, MessageCircle, Ban, Flag, Globe, Lock, EyeOff } from "lucide-react";
import { WeeklyAchievementsBadge } from "@/components/WeeklyAchievementsBadge";
import { RoomEntryEffect, type EntryBurst, type EntryEffectType } from "@/components/RoomEntryEffect";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { getOnline } from "@/lib/use-online";

export const Route = createFileRoute("/app/profile/$id")({
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
  cover_url: string | null;
  cover_type: string | null;
};

function OtherProfilePage() {
  const { id: otherId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [entryBurst, setEntryBurst] = useState<EntryBurst | null>(null);

  // Play the profile owner's equipped entry effect once per profile open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase.from("profiles")
        .select("username, equipped_effect").eq("id", otherId).maybeSingle();
      if (cancelled || !p?.equipped_effect) return;
      const { data: item } = await supabase.from("shop_items")
        .select("code, kind").eq("id", p.equipped_effect).maybeSingle();
      if (cancelled || !item?.code?.startsWith("entry_")) return;
      const type = item.code.replace("entry_", "") as EntryEffectType;
      setEntryBurst({ id: Date.now() + Math.random(), type, name: p.username });
    })();
    return () => { cancelled = true; };
  }, [otherId]);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      setLoading(true);

      // 1) Show cached profile immediately if we have one.
      const cached = await cacheGet<Profile>(cacheKeys.profile(otherId));
      if (cached) {
        setProfile(cached);
        setLoading(false);
      }

      // 2) If offline, stop here — don't retry network or show error toast.
      if (!getOnline()) {
        if (!cached) {
          toast.error("أنت غير متصل بالإنترنت");
          setLoading(false);
        }
        return;
      }

      const selectCols = "id, username, avatar_url, bio, points, gender, country, hide_last_seen, dm_locked, last_seen_at, cover_url, cover_type";
      let p: any = null;
      let lastErr: any = null;
      for (let i = 0; i < 2; i++) {
        const res = await supabase.from("profiles").select(selectCols).eq("id", otherId).maybeSingle();
        if (res.data) { p = res.data; lastErr = null; break; }
        lastErr = res.error;
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!p) {
        if (!cached) {
          console.error("profile fetch failed", { otherId, lastErr });
          toast.error(lastErr?.message ? `تعذر تحميل البروفايل: ${lastErr.message}` : "تعذر تحميل البروفايل، حاول مرة أخرى");
        }
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      void cacheSet(cacheKeys.profile(otherId), p);

      // Check block + friendship status
      const [{ data: blockMe }, { data: blockByMe }, { data: fr }] = await Promise.all([
        supabase.from("dm_blocks").select("blocker_id").eq("blocker_id", otherId).eq("blocked_id", user.id).maybeSingle(),
        supabase.from("dm_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", otherId).maybeSingle(),
        supabase.from("friendships").select("status")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user.id})`)
          .eq("status", "accepted").maybeSingle(),
      ]);
      setIsBlockedBy(!!blockMe);
      setIsBlocked(!!blockByMe);
      setIsFriend(!!fr);
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
    if (!isFriend) return ""; // hide for non-friends
    if (profile.hide_last_seen) return "آخر ظهور مخفي";
    if (!profile.last_seen_at) return "غير متصل";
    const diff = (Date.now() - new Date(profile.last_seen_at).getTime()) / 1000;
    if (diff < 60) return "متصل الآن";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return `منذ ${Math.floor(diff / 86400)} يوم`;
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!profile) return null;

  const isOwnProfile = user?.id === profile.id;

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background">
      <RoomEntryEffect burst={entryBurst} />
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
        {profile.cover_url && (
          <div className="relative mb-4 h-44 overflow-hidden rounded-3xl border border-border">
            {profile.cover_type === "video" ? (
              <video src={profile.cover_url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary p-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-primary text-4xl font-bold text-primary-foreground ring-4 ring-background shadow-xl">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  {profile.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Username */}
            <h1 className="mt-4 text-2xl font-extrabold">{profile.username}</h1>
            
            {/* Points & Status */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                🪙 {profile.points} نقطة
              </span>
              {formatLastSeen() && (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                  {formatLastSeen()}
                </span>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-4 max-w-md text-sm text-muted-foreground">{profile.bio}</p>
            )}

            {/* Gender & Country */}
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

            {/* Privacy Info */}
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

            <UserBadgesGrid userId={profile.id} />

            <div className="mt-2 w-full max-w-md">
              <WeeklyAchievementsBadge userId={profile.id} />
            </div>

            {/* Action Buttons */}
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

            {/* Blocked by other message */}
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