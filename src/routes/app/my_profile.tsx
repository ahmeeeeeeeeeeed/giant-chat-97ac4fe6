import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_VERSION } from "@/lib/version";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WeeklyAchievementsBadge } from "@/components/WeeklyAchievementsBadge";
import { UserBadgesGrid } from "@/components/UserBadges";
import { toast } from "sonner";
import { Loader2, Camera, User as UserIcon, Bell, Info, Shield, ChevronLeft, Lock, EyeOff, Globe, Eye, Mail, CheckCircle2, KeyRound, History, Trash2, ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getEquipped, type EquippedSet } from "@/lib/equipped";
import { BadgeChip } from "@/routes/app/store";

import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";

export const Route = createFileRoute("/app/my_profile")({
  component: ProfilePage,
});

const COUNTRIES = [
  "السعودية", "مصر", "الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "الأردن",
  "العراق", "سوريا", "لبنان", "فلسطين", "اليمن", "السودان", "ليبيا", "تونس",
  "الجزائر", "المغرب", "موريتانيا", "تركيا", "أخرى",
];

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverType, setCoverType] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [points, setPoints] = useState<number>(0);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [country, setCountry] = useState<string>("");
  const [hideLastSeen, setHideLastSeen] = useState(false);
  const [dmLocked, setDmLocked] = useState(false);
  const [profileViews, setProfileViews] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [equipped, setEquipped] = useState<EquippedSet>({});
  const [notifEnabled, setNotifEnabled] = useState(
    typeof window !== "undefined" && localStorage.getItem("giant.notif") === "1"
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    // Always fetch fresh so newly purchased/equipped items appear immediately
    import("@/lib/equipped").then(({ clearEquippedCache }) => clearEquippedCache(user.id));
    getEquipped(user.id).then(setEquipped);
  }, [user]);

  const [accountEmail, setAccountEmail] = useState<string>("");
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      type CachedProfile = {
        username: string; bio: string | null; avatar_url: string | null;
        points: number | null; gender: "male" | "female" | null; country: string | null;
        hide_last_seen: boolean | null; dm_locked: boolean | null; profile_views: number | null;
      };
      const cached = await cacheGet<CachedProfile>(cacheKeys.profile(user.id));
      if (cached) {
        setUsername(cached.username);
        setBio(cached.bio ?? "");
        setAvatarUrl(cached.avatar_url);
        setPoints(cached.points ?? 0);
        setGender(cached.gender ?? null);
        setCountry(cached.country ?? "");
        setHideLastSeen(!!cached.hide_last_seen);
        setDmLocked(!!cached.dm_locked);
        setProfileViews(cached.profile_views ?? 0);
        setLoading(false);
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, bio, avatar_url, points, gender, country, hide_last_seen, dm_locked, profile_views, cover_url, cover_type")
          .eq("id", user.id).maybeSingle();
        if (error) throw error;
        if (data) {
          setUsername(data.username);
          setBio(data.bio ?? "");
          setAvatarUrl(data.avatar_url);
          setCoverUrl((data as any).cover_url ?? null);
          setCoverType((data as any).cover_type ?? null);
          setPoints(data.points ?? 0);
          setGender((data.gender as "male" | "female" | null) ?? null);
          setCountry(data.country ?? "");
          setHideLastSeen(!!data.hide_last_seen);
          setDmLocked(!!data.dm_locked);
          setProfileViews(data.profile_views ?? 0);
          await cacheSet(cacheKeys.profile(user.id), data as CachedProfile);
        }
        // Load the auth account's email (Supabase Auth) + any pending change.
        try {
          const { data: au } = await supabase.auth.getUser();
          if (au?.user) {
            setAccountEmail(au.user.email ?? "");
            const pend = (au.user as any).new_email as string | undefined;
            setPendingEmail(pend ?? "");
          }
        } catch { /* ignore */ }
      } catch {
        // offline — keep cached values
      }
      setLoading(false);
    })();

  }, [user]);

  const sendChangeEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("بريد غير صالح"); return;
    }
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail.trim() },
        { emailRedirectTo: `${window.location.origin}/app` },
      );
      if (error) throw error;
      setPendingEmail(newEmail.trim());
      setEditingEmail(false);
      setNewEmail("");
      toast.success("تم إرسال رابط التأكيد إلى بريدك الجديد", { duration: 8000 });
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إرسال رابط التأكيد");
    } finally { setEmailBusy(false); }
  };



  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      bio: bio.trim() || null,
      gender,
      country: country || null,
      hide_last_seen: hideLastSeen,
      dm_locked: dmLocked,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(t("common.error")); return; }
    toast.success(t("profile.saved"));
  };

  const updateFlag = async (field: "hide_last_seen" | "dm_locked", value: boolean) => {
    if (!user) return;
    const payload = field === "hide_last_seen" ? { hide_last_seen: value } : { dm_locked: value };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) toast.error(t("common.error"));
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Max 3MB"); return; }
    setUploading(true);
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(url);
      toast.success(t("profile.saved"));
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("الحد الأقصى 15 ميجابايت"); return; }
    setCoverUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-covers")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("profile-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const url = signed?.signedUrl;
      if (!url) throw new Error("no_url");
      const t2 = file.type.startsWith("video") ? "video" : (file.type === "image/gif" ? "gif" : "image");
      const { error } = await supabase.rpc("set_profile_cover" as never, { _url: url, _type: t2 } as never);
      if (error) throw error;
      setCoverUrl(url); setCoverType(t2);
      toast.success("تم تحديث الغلاف");
    } catch (err: any) {
      toast.error("فشل: " + (err?.message ?? ""));
    } finally {
      setCoverUploading(false);
    }
  };

  const removeCover = async () => {
    const { error } = await supabase.rpc("set_profile_cover" as never, { _url: null, _type: null } as never);
    if (error) { toast.error("فشل: " + error.message); return; }
    setCoverUrl(null); setCoverType(null);
    toast.success("تمت إزالة الغلاف");
  };

  const toggleNotif = async () => {
    const next = !notifEnabled;
    if (next && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error(t("common.error")); return; }
    }
    setNotifEnabled(next);
    localStorage.setItem("giant.notif", next ? "1" : "0");
  };

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("profile.title")}</h1>
      </header>

      <div className="px-5 py-6">
        {/* Cover */}
        <div className="relative mb-4 h-44 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-secondary">
          {coverUrl ? (
            coverType === "video" ? (
              <video src={coverUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={coverUrl} alt="غلاف" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-40" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
            <input ref={coverFileRef} type="file" accept="image/*,video/mp4,video/webm" onChange={onPickCover} className="hidden" />
            {coverUrl && (
              <button type="button" onClick={removeCover}
                className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-red-500">
                إزالة
              </button>
            )}
            <button type="button" onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
              className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-black backdrop-blur hover:bg-white disabled:opacity-60">
              {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {coverUrl ? "تغيير" : "إضافة غلاف"}
            </button>
          </div>
        </div>

        {/* Hero card */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative h-20 w-20 overflow-hidden rounded-full bg-primary text-2xl font-bold text-primary-foreground ring-2 ring-background"
              aria-label={t("profile.change_photo")}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">{username.charAt(0).toUpperCase()}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/60 py-1 text-white">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-lg font-bold" style={equipped.name_color ? { color: equipped.name_color.color, textShadow: `0 0 12px ${equipped.name_color.color}55` } : undefined}>{username}</div>
                {equipped.badge && <BadgeChip code={equipped.badge.code} color={equipped.badge.payload.color} name={equipped.badge.name_ar} />}
                {points > 10000 && !equipped.badge && <VipBadge />}
              </div>
              <div className="truncate text-xs text-muted-foreground">@{username} · {points} pts</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                <span>{profileViews} مشاهدة للملف</span>
              </div>
            </div>
          </div>
        </div>

        {user && <WeeklyAchievementsBadge userId={user.id} />}

        {/* Bio + identity form */}
        <form onSubmit={save} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.bio")}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder={t("profile.bio_placeholder")}
              className="min-h-[90px] rounded-2xl border border-input bg-card p-4 outline-none focus:border-primary"
            />
            <span className="text-end text-xs text-muted-foreground">{bio.length}/160</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">الجنس</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setGender("male")}
                className={`h-12 rounded-2xl border text-sm font-semibold transition ${gender === "male" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                ♂ ذكر
              </button>
              <button type="button" onClick={() => setGender("female")}
                className={`h-12 rounded-2xl border text-sm font-semibold transition ${gender === "female" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                ♀ أنثى
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Globe className="inline h-3 w-3" /> البلد
            </span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="h-12 rounded-2xl border border-input bg-card px-3 outline-none focus:border-primary">
              <option value="">— اختر البلد —</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <button
            disabled={saving}
            className="flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("profile.save")}
          </button>
        </form>

        {/* Settings sections */}
        <div className="mt-8 flex flex-col gap-4">
          <Section title="الخصوصية">
            <ToggleRow
              icon={<Lock className="h-5 w-5" />}
              label="قفل الرسائل الخاصة"
              hint="فقط الأصدقاء يمكنهم مراسلتك"
              value={dmLocked}
              onChange={(v) => { setDmLocked(v); updateFlag("dm_locked", v); }}
            />
            <ToggleRow
              icon={<EyeOff className="h-5 w-5" />}
              label="إخفاء آخر ظهور"
              hint="لن يظهر آخر وقت كنت فيه نشطاً"
              value={hideLastSeen}
              onChange={(v) => { setHideLastSeen(v); updateFlag("hide_last_seen", v); }}
            />
          </Section>

          <Section title={t("profile.account")}>
            <Row icon={<UserIcon className="h-5 w-5" />} label={t("profile.username")} value={username} />
          </Section>

          <Section title="بريد الحساب">
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    البريد المرتبط بحسابك
                    {accountEmail && (
                      <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                        <CheckCircle2 className="h-3 w-3" /> مؤكَّد
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    يُستخدم لتسجيل الدخول واسترجاع كلمة المرور
                  </p>
                </div>
              </div>

              {accountEmail ? (
                <div className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold">
                  @{username}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-xs text-muted-foreground">
                  لا يوجد بريد مرتبط بعد
                </div>
              )}

              {pendingEmail && pendingEmail !== accountEmail && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  بانتظار التأكيد: <span dir="ltr" className="font-semibold">{pendingEmail}</span>
                  <div className="mt-1">افتح رابط التأكيد المُرسل إلى البريد الجديد.</div>
                </div>
              )}

              {editingEmail && (
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  dir="ltr"
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary"
                />
              )}

              <div className="flex gap-2">
                {!editingEmail ? (
                  <button
                    type="button"
                    onClick={() => setEditingEmail(true)}
                    className="h-10 w-full rounded-xl border border-border bg-card text-sm font-semibold"
                  >
                    {accountEmail ? "تغيير البريد" : "إضافة بريد"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={sendChangeEmail}
                      disabled={emailBusy || !newEmail}
                      className="flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
                    >
                      {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال رابط التأكيد"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingEmail(false); setNewEmail(""); }}
                      disabled={emailBusy}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold"
                    >
                      إلغاء
                    </button>
                  </>
                )}
              </div>
            </div>
          </Section>



          <Section title={t("profile.notifications")}>
            <ToggleRow icon={<Bell className="h-5 w-5" />} label={t("settings.notifications_on")} value={notifEnabled} onChange={toggleNotif} />
          </Section>

          <Section title={t("profile.security")}>
            <Row icon={<Shield className="h-5 w-5" />} label={t("profile.security")} value="✓" />
            <PasswordChangeRow />
            <Link to="/app/account" className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5" />
                <span className="font-medium">سجلّ تسجيل الدخول</span>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
            </Link>
            <DeleteAccountRow email={accountEmail} username={username} />
          </Section>

          <Section title={t("profile.about")}>
            <Link to="/app/settings" search={{ about: 1 } as any} className="flex items-center justify-between p-4 active:bg-secondary/60">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5" />
                <span className="font-medium">Giant</span>
              </div>
              <span className="text-sm text-muted-foreground">v{APP_VERSION}</span>
            </Link>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180 hidden" />
    </div>
  );
}

function ToggleRow({ icon, label, hint, value, onChange }: {
  icon: React.ReactNode; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between p-4 text-start">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="font-medium">{label}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function VipBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm ring-1 ring-red-700/40"
      title="VIP"
    >
      ★ شخصية مهمة
    </span>
  );
}

function PasswordChangeRow() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    if (pw !== pw2) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message || "تعذّر التحديث"); return; }
    toast.success("تم تغيير كلمة المرور ✓");
    setPw(""); setPw2(""); setOpen(false);
  };

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-start"
      >
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5" />
          <span className="font-medium">تغيير كلمة المرور</span>
        </div>
        <ChevronLeft className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-90" : "rtl:rotate-180"}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              dir="ltr"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 pe-10 outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={show ? "إخفاء" : "إظهار"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="تأكيد كلمة المرور"
            dir="ltr"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !pw || !pw2}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ كلمة المرور الجديدة"}
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteAccountRow({ email, username }: { email: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", uid)
        .eq("status", "pending")
        .maybeSingle();
      setPending(!!data);
    })();
  }, []);

  const submit = async () => {
    if (!email) { toast.error("لا يوجد بريد للحساب"); return; }
    if (!pw) { toast.error("أدخل كلمة المرور"); return; }
    setBusy(true);
    try {
      // Verify password by attempting sign in (does not change current session)
      const { error: vErr } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (vErr) { toast.error("كلمة المرور غير صحيحة"); return; }

      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id;
      if (!uid) { toast.error("غير مسجّل دخول"); return; }

      const { error } = await supabase.from("account_deletion_requests").insert({
        user_id: uid,
        username_snapshot: username,
        email_snapshot: email,
        reason: reason.trim() || null,
      });
      if (error) {
        if (error.code === "23505") toast.error("لديك طلب قيد المراجعة بالفعل");
        else toast.error(error.message || "تعذّر إرسال الطلب");
        return;
      }
      toast.success("تم إرسال طلب حذف الحساب إلى الإدارة");
      setPw(""); setReason(""); setOpen(false); setPending(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-start"
      >
        <div className="flex items-center gap-3">
          <Trash2 className="h-5 w-5 text-red-600" />
          <span className="font-medium text-red-600">حذف الحساب</span>
        </div>
        <ChevronLeft className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-90" : "rtl:rotate-180"}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {pending ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
              طلبك قيد المراجعة من قِبل الإدارة.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                سيُرسل طلب حذف حسابك إلى الإدارة. أدخل كلمة المرور للتأكيد.
              </p>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="كلمة المرور"
                dir="ltr"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary"
              />
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب الحذف (اختياري)"
                rows={2}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy || !pw}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
