import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";
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

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("profile.title")}</h1>
      </header>

      <div className="px-5 py-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative h-20 w-20 overflow-hidden rounded-full bg-primary text-2xl font-bold text-primary-foreground"
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
          <div>
            <div className="text-lg font-bold">{username}</div>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
              {t("profile.change_photo")}
            </button>
          </div>
        </div>

        <form onSubmit={save} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("profile.bio")}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder={t("profile.bio_placeholder")}
              className="min-h-[100px] rounded-2xl border border-input bg-card p-4 outline-none focus:border-foreground"
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
      </div>
    </main>
  );
}
