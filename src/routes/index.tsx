import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Loader2, MessageCircle, Users, Music, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/app/friends" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-10 text-foreground">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -end-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -start-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 end-1/4 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />

      {/* Logo + brand */}
      <div className="relative z-10 mt-10 flex flex-col items-center text-center" style={{ animation: "rise 0.8s ease-out both" }}>
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/40 blur-2xl" />
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-primary to-success shadow-2xl ring-4 ring-card"
            style={{ animation: "logo-float 3s ease-in-out infinite alternate" }}
          >
            <span className="text-4xl font-black text-primary-foreground drop-shadow">G</span>
            <Sparkles className="absolute -top-2 -end-2 h-5 w-5 animate-pulse text-primary" />
          </div>
        </div>

        <h1
          className="mt-6 bg-gradient-to-b from-foreground to-primary bg-clip-text text-6xl font-black tracking-tight text-transparent"
          style={{ animation: "glow 3s ease-in-out infinite alternate" }}
        >
          Giant
        </h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          دردش • شارك • العب — مجتمعك في مكان واحد
        </p>
      </div>

      {/* Feature highlights */}
      <div className="relative z-10 mx-auto mt-10 grid w-full max-w-sm grid-cols-3 gap-3" style={{ animation: "rise 0.8s ease-out 0.15s both" }}>
        {[
          { Icon: MessageCircle, label: "محادثات" },
          { Icon: Users, label: "غرف" },
          { Icon: Music, label: "موسيقى" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="relative z-10 mx-auto w-full max-w-sm space-y-3" style={{ animation: "rise 0.8s ease-out 0.3s both" }}>
        <Link
          to="/login"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98]"
        >
          <LogIn className="h-5 w-5" />
          تسجيل الدخول
        </Link>

        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>أو</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Link
          to="/register"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-bold text-foreground transition active:scale-[0.98] hover:bg-accent"
        >
          إنشاء حساب جديد
        </Link>

        <p className="px-2 pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          بمتابعتك أنت توافق على{" "}
          <span className="underline">اتفاقية المستخدم</span> و{" "}
          <span className="underline">سياسة الخصوصية</span>
        </p>
      </div>

      <style>{`
        @keyframes rise {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes logo-float {
          0% { transform: translateY(0) rotate(-3deg); }
          100% { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes glow {
          0% { filter: drop-shadow(0 0 6px color-mix(in oklab, var(--primary) 30%, transparent)); }
          100% { filter: drop-shadow(0 0 18px color-mix(in oklab, var(--primary) 55%, transparent)); }
        }
      `}</style>
    </main>
  );
}
