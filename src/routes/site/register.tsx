import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight } from "lucide-react";
import { signUpSiteEmail, signInSiteEmail, signInSiteGoogle } from "@/lib/site-auth";

export const Route = createFileRoute("/site/register")({
  component: SiteRegisterPage,
  head: () => ({
    meta: [
      { title: "إنشاء حساب الموقع — Giant" },
      { name: "description", content: "أنشئ حسابك في موقع Giant لتقييم التطبيق وكتابة تعليقك." },
    ],
  }),
});

function SiteRegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("كلمة المرور 6 أحرف على الأقل");
    setBusy(true);
    const { error } = await signUpSiteEmail(email, password, name);
    if (error) { setBusy(false); return toast.error(error); }
    const { error: e2 } = await signInSiteEmail(email, password);
    setBusy(false);
    if (e2) return toast.error(e2);
    toast.success("تم إنشاء الحساب");
    navigate({ to: "/reviews" });
  };

  const onGoogle = async () => {
    setBusy(true);
    const r = await signInSiteGoogle();
    if ((r as any)?.error) { setBusy(false); toast.error("فشل التسجيل بجوجل"); }
  };

  return (
    <main dir="rtl" className="relative flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-emerald-500/10 px-5 py-10 text-foreground">
      <Link to="/" className="absolute top-5 right-5 text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-6 w-6 rtl:rotate-180" />
      </Link>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-2xl font-black text-primary-foreground shadow-lg">G</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">إنشاء حساب الموقع</h1>
          <p className="mt-2 text-sm text-muted-foreground">للتقييم والتعليق فقط — منفصل تماماً عن حساب التطبيق.</p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-xl backdrop-blur">
          <button
            type="button" onClick={onGoogle} disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background font-bold transition hover:bg-accent active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleIcon /> المتابعة باستخدام Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> أو بالبريد <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field icon={<UserIcon className="h-4 w-4" />} label="الاسم الظاهر (اختياري)">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                className="h-12 w-full rounded-2xl border border-input bg-background ps-10 pe-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="مثلاً: أحمد" />
            </Field>
            <Field icon={<Mail className="h-4 w-4" />} label="البريد الإلكتروني">
              <input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="h-12 w-full rounded-2xl border border-input bg-background ps-10 pe-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="you@example.com" />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="كلمة المرور">
              <input type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                className="h-12 w-full rounded-2xl border border-input bg-background ps-10 pe-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="6 أحرف على الأقل" />
            </Field>

            <button type="submit" disabled={busy}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-500 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "إنشاء الحساب"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          لديك حساب بالفعل؟{" "}
          <Link to="/site/login" className="font-bold text-primary hover:underline">تسجيل الدخول</Link>
        </p>
      </div>
    </main>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 7.1 29.5 5 24 5 16 5 9.1 9.5 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.4l-6.3-5.3C29.4 34.7 26.8 35.5 24 35.5c-5.3 0-9.7-3-11.3-7.5l-6.6 5.1C8.8 39.5 15.8 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3C40.9 35.5 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
