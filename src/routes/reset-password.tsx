import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase JS client auto-parses the recovery token in the URL hash and
    // emits PASSWORD_RECOVERY. We just wait until a session exists.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    if (pwd !== pwd2) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message || "تعذّر تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-8 text-foreground">
      <div className="pointer-events-none absolute -top-20 -end-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -start-20 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />

      <Link to="/login" className="relative z-10 self-start text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-6 w-6 rtl:rotate-180" />
      </Link>

      <div className="relative z-10 mt-6 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-lg">
          <ShieldCheck className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mt-4 text-2xl font-black">كلمة مرور جديدة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready ? "أدخل كلمة المرور الجديدة لحسابك" : "جارٍ التحقق من الرابط..."}
        </p>
      </div>

      {ready && (
        <form onSubmit={submit} className="relative z-10 mt-8 flex flex-col gap-3">
          <PwdField value={pwd} onChange={setPwd} placeholder="كلمة المرور الجديدة" />
          <PwdField value={pwd2} onChange={setPwd2} placeholder="تأكيد كلمة المرور" />
          <button
            type="submit"
            disabled={loading}
            className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "حفظ كلمة المرور"}
          </button>
        </form>
      )}
    </main>
  );
}

function PwdField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Lock className="h-4 w-4" />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="password"
        dir="ltr"
        placeholder={placeholder}
        required
        className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
