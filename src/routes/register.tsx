import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { signUpWithUsername, signInWithUsername } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error(t("common.error")); return; }
    setLoading(true);
    const { error } = await signUpWithUsername(username, password);
    if (error) { setLoading(false); toast.error(error); return; }
    const { error: e2 } = await signInWithUsername(username, password);
    setLoading(false);
    if (e2) { toast.error(e2); return; }
    navigate({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen flex-col bg-background px-6 py-8">
      <Link to="/" className="self-start text-muted-foreground"><ArrowRight className="h-6 w-6 rtl:rotate-180" /></Link>
      <div className="mt-10">
        <h1 className="text-3xl font-bold">{t("auth.register")}</h1>
        <p className="mt-2 text-muted-foreground">{t("app.name")}</p>
      </div>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("auth.username")}</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-foreground" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("auth.password")}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-foreground" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("auth.confirm")}</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-foreground" required />
        </label>

        <button type="submit" disabled={loading}
          className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.register")}
        </button>
      </form>

      <p className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        {t("auth.have_account")} <Link to="/login" className="font-semibold text-foreground">{t("auth.login")}</Link>
      </p>
    </main>
  );
}
