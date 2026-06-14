import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Coins, Megaphone, Hash, Loader2, ChevronLeft, Newspaper, Users as UsersIcon, Package, Crown } from "lucide-react";
import { toast } from "sonner";
import { PremiumCreateModal } from "@/components/PremiumCreateModal";

export const Route = createFileRoute("/app/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [broadcast, setBroadcast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  useEffect(() => {
    if (loaded && !isAdmin) {
      toast.error("هذه الصفحة للمسؤولين فقط");
      navigate({ to: "/app" });
    }
  }, [loaded, isAdmin, navigate]);

  if (!loaded) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return null;

  const sendPoints = async () => {
    if (!target.trim() || !amount) return;
    setBusy(true);
    try {
      const uname = target.trim().replace(/^@/, "");
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", uname)
        .maybeSingle();
      if (pErr) { toast.error(pErr.message); return; }
      if (!prof?.id) { toast.error("المستخدم غير موجود"); return; }
      const { error } = await supabase.rpc("admin_send_points", { _target: prof.id, _amount: amount });
      if (error) { toast.error(error.message); return; }
      toast.success("تم إرسال النقاط");
      setTarget("");
    } finally {
      setBusy(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_broadcast", { _text: broadcast.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("تم إرسال الإعلان"); setBroadcast(""); }
  };

  return (
    <main className="flex flex-1 flex-col p-4 gap-4">
      <header className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-emerald-600" />
        <div>
          <h1 className="text-xl font-extrabold">لوحة الإدارة</h1>
          <p className="text-xs text-muted-foreground">أدوات المسؤول</p>
        </div>
      </header>

      <div className="grid gap-3">
        <Link to="/app/admin/users"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/40 transition">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">إدارة المستخدمين</div>
              <div className="text-xs text-muted-foreground">عرض الجميع، حظر، صلاحيات، نقاط، حذف</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link to="/app/admin/rooms"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/40 transition">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">التحكم بالغرف</div>
              <div className="text-xs text-muted-foreground">إدارة، حذف، وقفل أي غرفة</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link to="/app/admin/community"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/40 transition">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-600">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">إدارة المجتمع</div>
              <div className="text-xs text-muted-foreground">مراجعة البلاغات وحذف أي منشور</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link to="/app/admin/updates"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/40 transition">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">التحديثات</div>
              <div className="text-xs text-muted-foreground">رفع APK جديد، إجباري أو اختياري</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Link>

        <button onClick={() => setShowPremium(true)}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/40 transition text-start">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold">إنشاء حساب مميز</div>
              <div className="text-xs text-muted-foreground">إنشاء مباشر بدون خصم نقاط</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>


        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold">إرسال نقاط</h2>
          </div>
          <div className="flex flex-col gap-2">
            <input value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="اسم المستخدم المستلم"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="عدد النقاط"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            <button onClick={sendPoints} disabled={busy || !target.trim() || !amount}
              className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
              {busy ? "..." : "إرسال"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            <h2 className="font-bold">إعلان عام</h2>
          </div>
          <textarea value={broadcast} onChange={(e) => setBroadcast(e.target.value)}
            placeholder="اكتب الإعلان الذي سيظهر للجميع…" rows={3}
            className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" />
          <button onClick={sendBroadcast} disabled={busy || !broadcast.trim()}
            className="mt-2 h-11 w-full rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
            {busy ? "..." : "إرسال الإعلان"}
          </button>
        </section>
      </div>
    </main>
  );
}
