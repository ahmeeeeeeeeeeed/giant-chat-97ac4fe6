import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles").select("username, bio").eq("id", user.id).maybeSingle();
      if (data) { setUsername(data.username); setBio(data.bio ?? ""); }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ bio: bio.trim() || null }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم حفظ التغييرات");
  };

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">حسابي</h1>
      </header>

      <div className="px-5 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold">{username}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="online-dot inline-block h-2 w-2 rounded-full" />
              متصل الآن
            </div>
          </div>
        </div>

        <form onSubmit={save} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">نبذة تعريفية</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder="عرّف عن نفسك بكلمات قليلة…"
              className="min-h-[100px] rounded-2xl border border-input bg-card p-4 outline-none focus:border-foreground"
            />
            <span className="text-left text-xs text-muted-foreground">{bio.length}/160</span>
          </label>

          <button
            disabled={saving}
            className="flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "حفظ"}
          </button>
        </form>
      </div>
    </main>
  );
}
