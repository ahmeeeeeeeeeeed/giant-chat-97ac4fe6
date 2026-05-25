import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-12">
      {/* subtle gradient halo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/5 blur-3xl" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-black/40">
          <MessageCircle className="h-14 w-14" strokeWidth={2.25} />
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight">Giant</h1>
        <p className="mt-4 max-w-xs text-base text-muted-foreground">
          غرف دردشة، مجتمعات، ومحادثات خاصة. فوريّة وآمنة.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          to="/login"
          className="flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
        >
          تسجيل الدخول
        </Link>
        <Link
          to="/register"
          className="flex h-12 items-center justify-center rounded-2xl border border-border bg-card text-base font-semibold text-foreground transition active:scale-[0.98]"
        >
          إنشاء حساب
        </Link>
      </div>
    </main>
  );
}
