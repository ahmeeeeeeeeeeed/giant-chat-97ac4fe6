import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recovery")({
  component: RecoveryPage,
});

function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("بريد غير صالح");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("تم إرسال رابط استرجاع كلمة المرور إلى بريدك");
    } catch {
      // Don't leak whether the email exists
      setSent(true);
      toast.success("إذا كان البريد مسجلاً، فستصلك رسالة استرجاع");
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
        <h1 className="mt-4 text-2xl font-black">استرجاع الحساب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل بريدك الإلكتروني المسجَّل وسنرسل لك رابطًا لإعادة تعيين كلمة المرور
        </p>
      </div>

      {sent ? (
        <div className="relative z-10 mt-8 rounded-2xl border border-border bg-card p-5 text-center">
          <Mail className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-semibold">تحقّق من بريدك</p>
          <p className="mt-1 text-xs text-muted-foreground">
            افتح الرابط من رسالة البريد لإعداد كلمة مرور جديدة. قد تجد الرسالة في مجلد الرسائل غير المرغوب فيها.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 text-xs text-primary underline"
          >
            إعادة الإرسال
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="relative z-10 mt-8 flex flex-col gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Mail className="h-4 w-4" />
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
              required
              className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال رابط الاسترجاع"}
          </button>
        </form>
      )}
    </main>
  );
}
