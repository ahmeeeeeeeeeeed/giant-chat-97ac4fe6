import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import { Shield, Coins, Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { t } = useTranslation();
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingPts, setSendingPts] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [sendingBc, setSendingBc] = useState(false);

  useEffect(() => {
    if (loaded && !isAdmin) navigate({ to: "/app" });
  }, [loaded, isAdmin, navigate]);

  const sendPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!username.trim() || isNaN(amt) || amt === 0) { toast.error(t("common.error")); return; }
    setSendingPts(true);
    const { data: prof } = await supabase.from("profiles").select("id").eq("username", username.trim()).maybeSingle();
    if (!prof) { setSendingPts(false); toast.error(t("admin.user_not_found")); return; }
    const { error } = await supabase.rpc("admin_send_points", { _target: prof.id, _amount: amt });
    setSendingPts(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.points_sent"));
    setUsername(""); setAmount("");
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.trim()) return;
    setSendingBc(true);
    const { error } = await supabase.rpc("admin_broadcast", { _text: broadcast.trim() });
    setSendingBc(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.broadcast_sent"));
    setBroadcast("");
  };

  if (!loaded) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">{t("admin.only")}</div>;
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{t("admin.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("admin.subtitle")}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <h2 className="text-base font-bold">{t("admin.send_points")}</h2>
          </div>
          <form onSubmit={sendPoints} className="flex flex-col gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder={t("admin.target_user")}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-foreground" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number"
              placeholder={t("admin.amount")}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-foreground" />
            <button type="submit" disabled={sendingPts || !username.trim() || !amount}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
              {sendingPts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {t("admin.send_points")}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-bold">{t("admin.broadcast")}</h2>
          </div>
          <form onSubmit={sendBroadcast} className="flex flex-col gap-2">
            <textarea value={broadcast} onChange={(e) => setBroadcast(e.target.value)}
              placeholder={t("admin.broadcast_placeholder")} rows={4}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
            <button type="submit" disabled={sendingBc || !broadcast.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
              {sendingBc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {t("admin.broadcast")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
