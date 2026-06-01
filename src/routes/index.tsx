import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { MessageCircle, Users, Gamepad2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 -z-10 rounded-[2rem] bg-primary/40 blur-2xl" />
          <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/20">
            <MessageCircle className="h-14 w-14" strokeWidth={2.25} />
          </div>
        </div>

        <h1 className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-6xl font-extrabold tracking-tight text-transparent">
          {t("app.name")}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-medium text-muted-foreground leading-relaxed">
          منصة دردشة احترافية · غرف عامة · محادثات خاصة · ألعاب جماعية
        </p>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2">
          <FeatureCard icon={<Users className="h-5 w-5" />} label="غرف" />
          <FeatureCard icon={<Gamepad2 className="h-5 w-5" />} label="ألعاب" />
          <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} label="آمن" />
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          to="/register"
          className="flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98]"
        >
          ابدأ الآن مجاناً
        </Link>
        <Link
          to="/login"
          className="flex h-12 items-center justify-center rounded-2xl border border-border bg-card text-base font-semibold text-foreground transition active:scale-[0.98]"
        >
          {t("auth.login")}
        </Link>
        <p className="text-center text-[11px] text-muted-foreground">
          بالمتابعة فأنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </main>
  );
}

function FeatureCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
