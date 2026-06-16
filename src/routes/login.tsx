import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { signInWithUsername } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, Loader2, Eye, EyeOff, User, Lock, Sparkles } from "lucide-react";
const WELCOME_POSTER = "/media/welcome-poster.jpg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("giant.remember.user") ?? "" : ""
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("giant.remember.user") !== null : false
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithUsername(username, password);
    setLoading(false);
    if (error) { toast.error(error); return; }
    if (remember) localStorage.setItem("giant.remember.user", username.trim());
    else localStorage.removeItem("giant.remember.user");
    navigate({ to: "/app" });
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-8 text-foreground">
      {/* Still image background from welcome video */}
      <img
        src={assetUrl(welcomePoster.url)}
        alt=""
        loading="eager"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-40"
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-background/80 via-background/60 to-background/95" />
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-20 -end-20 z-0 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -start-20 z-0 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />


      <Link to="/" className="relative z-10 self-start text-muted-foreground transition hover:text-foreground">
        <ArrowRight className="h-6 w-6 rtl:rotate-180" />
      </Link>

      {/* Logo + tagline */}
      <div className="relative z-10 mt-8 flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/40 blur-2xl" />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-primary to-success shadow-2xl ring-4 ring-card"
            style={{ animation: "logo-float 3s ease-in-out infinite alternate" }}
          >
            <span className="text-3xl font-black text-primary-foreground drop-shadow-md">G</span>
            <Sparkles className="absolute -top-2 -end-2 h-5 w-5 animate-pulse text-primary" />
          </div>
        </div>

        <h1 className="mt-5 bg-gradient-to-b from-foreground to-primary bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Giant
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          مرحباً بعودتك ✨ دردش، شارك، والعب — كل شيء في مكان واحد
        </p>
      </div>


      <form onSubmit={submit} className="relative z-10 mt-10 flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("auth.username")}</span>
          <div className="relative">
            <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              dir="ltr"
              className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="اسم المستخدم"
              required
            />
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted-foreground">{t("auth.password")}</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              className="h-12 w-full rounded-2xl border border-input bg-card ps-10 pe-12 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd(s => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="إظهار/إخفاء كلمة المرور"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="mt-1 flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-muted-foreground">تذكّرني</span>
          </label>
          <Link to="/recovery" className="font-bold text-primary hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.login")}
        </button>

      </form>

      <p className="relative z-10 mt-auto pt-8 text-center text-sm text-muted-foreground">
        {t("auth.no_account")}{" "}
        <Link to="/register" className="font-bold text-primary underline-offset-2 hover:underline">
          {t("auth.register")}
        </Link>
      </p>

      <style>{`
        @keyframes logo-float {
          0% { transform: translateY(0) rotate(-3deg); }
          100% { transform: translateY(-6px) rotate(3deg); }
        }
      `}</style>
    </main>
  );
}
