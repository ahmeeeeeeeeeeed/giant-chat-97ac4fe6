import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Camera, User as UserIcon, Bell, Info, Shield, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(
    typeof window !== "undefined" && localStorage.getItem("giant.notif") === "1"
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles").select("username, bio, avatar_url").eq("id", user.id).maybeSingle();
      if (data) { setUsername(data.username); setBio(data.bio ?? ""); setAvatarUrl(data.avatar_url); }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ bio: bio.trim() || null }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(t("common.error")); return; }
    toast.success(t("profile.saved"));
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
        {/* Hero card */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-secondary p-5">
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
              <div className="truncate text-lg font-bold">{username}</div>
              <div className="truncate text-xs text-muted-foreground">@{username}</div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <form onSubmit={save} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.bio")}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder={t("profile.bio_placeholder")}
              className="min-h-[90px] rounded-2xl border border-input bg-card p-4 outline-none focus:border-foreground"
            />
            <span className="text-end text-xs text-muted-foreground">{bio.length}/160</span>
          </label>
          <button
            disabled={saving}
            className="flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("profile.save")}
          </button>
        </form>

        {/* Settings sections */}
        <div className="mt-8 flex flex-col gap-4">
          <Section title={t("profile.account")}>
            <Row icon={<UserIcon className="h-5 w-5" />} label={t("profile.username")} value={username} />
          </Section>

          <Section title={t("profile.notifications")}>
            <button onClick={toggleNotif} className="flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                <span className="font-medium">{t("settings.notifications_on")}</span>
              </div>
              <span className={`h-6 w-11 rounded-full transition ${notifEnabled ? "bg-primary" : "bg-muted"} relative`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition ${notifEnabled ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          </Section>

          <Section title={t("profile.security")}>
            <Row icon={<Shield className="h-5 w-5" />} label={t("profile.security")} value="✓" />
          </Section>

          <Section title={t("profile.about")}>
            <Row icon={<Info className="h-5 w-5" />} label="Giant" value="v1.0" />
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
