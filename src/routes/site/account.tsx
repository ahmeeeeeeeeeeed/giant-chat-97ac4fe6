import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, LogOut, Star, Mail } from "lucide-react";
import { signOutSite, useSiteAuth } from "@/lib/site-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/site/account")({
  component: SiteAccountPage,
  head: () => ({
    meta: [{ title: "حساب الموقع — Giant" }],
  }),
});

function SiteAccountPage() {
  const { user, loading } = useSiteAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/site/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </main>
    );
  }

  const displayName = (user.user_metadata?.display_name as string | undefined) || user.email?.split("@")[0] || "مستخدم";

  return (
    <main dir="rtl" className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-6 w-6 rtl:rotate-180" />
          </Link>
          <span className="font-bold">حسابي في الموقع</span>
          <span className="w-6" />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-2xl font-black text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-extrabold">{displayName}</div>
              <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/reviews" className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-500 px-4 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98]">
              <Star className="h-5 w-5" /> اكتب تقييماً للتطبيق
            </Link>
            <button
              onClick={async () => { await signOutSite(); toast.success("تم تسجيل الخروج"); navigate({ to: "/" }); }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 font-bold transition hover:bg-accent active:scale-[0.98]"
            >
              <LogOut className="h-5 w-5" /> تسجيل الخروج
            </button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            هذا الحساب خاص بالموقع فقط ولا يمنحك أي صلاحية داخل تطبيق Giant.
          </p>
        </div>
      </section>
    </main>
  );
}
