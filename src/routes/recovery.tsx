import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { requestAccountRecovery, resetPasswordWithCode } from "@/lib/recovery.functions";

export const Route = createFileRoute("/recovery")({
  component: RecoveryPage,
});

function RecoveryPage() {
  const navigate = useNavigate();
  const requestFn = useServerFn(requestAccountRecovery);
  const resetFn = useServerFn(resetPasswordWithCode);

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await requestFn({ data: { username, email } });
      if (!r.ok) {
        toast.error("لا يوجد حساب بهذا الاسم والبريد المؤكد");
      } else {
        // Dev fallback — until email infra is configured the code is shown here
        if (r.code) {
          toast.success(`تم إرسال الكود (للتجريب: ${r.code})`, { duration: 12000 });
        } else {
          toast.success("تم إرسال الكود إلى بريدك");
        }
        setStep(2);
      }
    } catch {
      toast.error("تعذّر إرسال الكود");
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      await resetFn({ data: { username, code, newPassword: pwd } });
      toast.success("تم تغيير كلمة المرور — سجّل الدخول الآن");
      navigate({ to: "/login" });
    } catch {
      toast.error("الكود غير صحيح أو منتهي");
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
          {step === 1 ? "أدخل اسم المستخدم والبريد المؤكد" : "أدخل الكود وكلمة المرور الجديدة"}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={sendCode} className="relative z-10 mt-8 flex flex-col gap-3">
          <Field icon={<KeyRound className="h-4 w-4" />} value={username} onChange={setUsername} placeholder="اسم المستخدم" autoComplete="username" dir="ltr" />
          <Field icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} placeholder="البريد الإلكتروني" type="email" autoComplete="email" dir="ltr" />
          <SubmitBtn loading={loading}>إرسال الكود</SubmitBtn>
        </form>
      ) : (
        <form onSubmit={reset} className="relative z-10 mt-8 flex flex-col gap-3">
          <Field icon={<KeyRound className="h-4 w-4" />} value={code} onChange={setCode} placeholder="الكود المكوّن من 6 أرقام" inputMode="numeric" dir="ltr" />
          <Field icon={<Lock className="h-4 w-4" />} value={pwd} onChange={setPwd} placeholder="كلمة المرور الجديدة" type="password" dir="ltr" />
          <SubmitBtn loading={loading}>تأكيد كلمة المرور</SubmitBtn>
          <button type="button" onClick={() => setStep(1)} className="mt-1 text-xs text-muted-foreground underline">
            عودة
          </button>
        </form>
      )}
    </main>
  );
}

function Field({ icon, value, onChange, placeholder, type = "text", autoComplete, inputMode, dir }: {
  icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string;
  type?: string; autoComplete?: string; inputMode?: "numeric" | "text"; dir?: "ltr" | "rtl";
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        dir={dir}
        placeholder={placeholder}
        required
        className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}
