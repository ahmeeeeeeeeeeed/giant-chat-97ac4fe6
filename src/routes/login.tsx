import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { signInWithUsername } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithUsername(username, password);
    setLoading(false);
    if (error) { toast.error(error); return; }
    navigate({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen flex-col bg-background px-6 py-8">
      <Link to="/" className="self-start text-muted-foreground"><ArrowRight className="h-6 w-6 rtl:rotate-180" /></Link>
      <div className="mt-10">
        <h1 className="text-3xl font-bold">{t("auth.login")}</h1>
        <p className="mt-2 text-muted-foreground">{t("app.name")}</p>
      </div>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("auth.username")}</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-foreground" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("auth.password")}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-foreground" placeholder="••••••••" required />
        </label>

        <button type="submit" disabled={loading}
          className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.login")}
        </button>
      </form>

      <p className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        {t("auth.no_account")} <Link to="/register" className="font-semibold text-foreground">{t("auth.register")}</Link>
      </p>
    </main>
  );
}
