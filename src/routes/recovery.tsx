import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail, ShieldCheck, KeyRound, Lock, Eye, EyeOff, RotateCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recovery")({
  component: RecoveryPage,
});

type Step = "email" | "code" | "password" | "done";

const OTP_TTL_SEC = 600; // 10 دقائق
const RESEND_COOLDOWN = 60; // ثانية

function RecoveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ttl, setTtl] = useState(0); // ثوانٍ متبقّية على الرمز
  const [cooldown, setCooldown] = useState(0); // إعادة الإرسال
  const [attempts, setAttempts] = useState(0);
  const tickRef = useRef<number | null>(null);

  // عدّاد تنازلي موحَّد
  useEffect(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setTtl((s) => (s > 0 ? s - 1 : 0));
      setCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const sendCode = async (silent = false) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("بريد إلكتروني غير صالح");
      return;
    }
    if (cooldown > 0) {
      toast.error(`انتظر ${cooldown}ث قبل إعادة الإرسال`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        // عدم تسريب وجود البريد من عدمه
        if (!silent) toast.success("إذا كان البريد مسجَّلاً ستصلك رسالة بالرمز");
      } else {
        toast.success("تم إرسال رمز التحقق إلى بريدك");
      }
      setStep("code");
      setTtl(OTP_TTL_SEC);
      setCooldown(RESEND_COOLDOWN);
      setAttempts(0);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) { toast.error("الرمز يجب أن يكون 6 أرقام"); return; }
    if (ttl <= 0) { toast.error("انتهت صلاحية الرمز، أعد الإرسال"); return; }
    if (attempts >= 5) { toast.error("محاولات كثيرة، أعد إرسال رمز جديد"); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setAttempts((a) => a + 1);
      toast.error("رمز غير صحيح");
      return;
    }
    setStep("password");
  };

  const setNewPassword = async () => {
    if (password.length < 8) { toast.error("كلمة المرور 8 أحرف على الأقل"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error("تعذّر تحديث كلمة المرور: " + error.message); return; }
    // سجل العملية في سجل الأمان (يفشل بصمت إذا الجدول غير موجود/RLS)
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user?.id) {
        await supabase.from("login_history").insert({
          user_id: u.user.id,
          event: "password_reset",
          ip: null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        } as any);
      }
    } catch { /* ignore */ }
    setStep("done");
    toast.success("تم تحديث كلمة المرور بنجاح");
    setTimeout(() => navigate({ to: "/app" }), 1500);
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
          {step === "done" ? <CheckCircle2 className="h-8 w-8 text-primary-foreground" /> : <ShieldCheck className="h-8 w-8 text-primary-foreground" />}
        </div>
        <h1 className="mt-4 text-2xl font-black">
          {step === "email" && "استرجاع الحساب"}
          {step === "code" && "أدخل رمز التحقق"}
          {step === "password" && "كلمة مرور جديدة"}
          {step === "done" && "تم بنجاح"}
        </h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {step === "email" && "أدخل بريدك المسجَّل وسنرسل لك رمز تحقق من 6 أرقام"}
          {step === "code" && `أرسلنا رمزًا من 6 أرقام إلى ${email}`}
          {step === "password" && "اختر كلمة مرور قوية لحسابك"}
          {step === "done" && "يمكنك الآن استخدام كلمة المرور الجديدة"}
        </p>
      </div>

      {/* خطوة 1: البريد */}
      {step === "email" && (
        <form
          onSubmit={(e) => { e.preventDefault(); void sendCode(); }}
          className="relative z-10 mt-8 flex flex-col gap-3"
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال الرمز"}
          </button>
        </form>
      )}

      {/* خطوة 2: الرمز */}
      {step === "code" && (
        <div className="relative z-10 mt-8 flex flex-col gap-3">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              placeholder="••••••"
              maxLength={6}
              className="h-14 w-full rounded-2xl border border-input bg-card ps-10 pe-4 text-center text-2xl font-black tracking-[0.6em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={`font-bold ${ttl > 0 ? "text-muted-foreground" : "text-destructive"}`}>
              {ttl > 0 ? `الرمز ينتهي خلال ${fmt(ttl)}` : "انتهت صلاحية الرمز"}
            </span>
            <button
              type="button"
              onClick={() => void sendCode(true)}
              disabled={cooldown > 0 || loading}
              className="flex items-center gap-1 font-bold text-primary disabled:text-muted-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {cooldown > 0 ? `إعادة الإرسال (${cooldown})` : "إعادة الإرسال"}
            </button>
          </div>

          <button
            onClick={() => void verifyCode()}
            disabled={loading || code.length !== 6}
            className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "تحقق من الرمز"}
          </button>

          <button
            type="button"
            onClick={() => setStep("email")}
            className="text-center text-xs text-muted-foreground hover:text-foreground"
          >
            تغيير البريد الإلكتروني
          </button>
        </div>
      )}

      {/* خطوة 3: كلمة المرور الجديدة */}
      {step === "password" && (
        <form
          onSubmit={(e) => { e.preventDefault(); void setNewPassword(); }}
          className="relative z-10 mt-8 flex flex-col gap-3"
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              dir="ltr"
              placeholder="••••••••"
              minLength={8}
              required
              className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="إظهار/إخفاء"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">8 أحرف على الأقل، يُفضَّل مزج أحرف وأرقام ورموز.</p>

          <button
            type="submit"
            disabled={loading || password.length < 8}
            className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      )}

      {/* خطوة 4: تم */}
      {step === "done" && (
        <div className="relative z-10 mt-8 rounded-2xl border border-border bg-card p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 text-sm font-semibold">تم تغيير كلمة المرور</p>
          <p className="mt-1 text-xs text-muted-foreground">سنحوّلك إلى التطبيق…</p>
        </div>
      )}
    </main>
  );
}
