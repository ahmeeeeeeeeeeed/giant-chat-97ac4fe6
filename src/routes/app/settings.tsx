import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import { signOut } from "@/lib/auth";
import { Moon, Sun, LogOut, ChevronLeft, Globe, Check, ShoppingBag } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showLang, setShowLang] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("settings.title")}</h1>
      </header>

      <div className="flex flex-col gap-3 px-4 py-5">
        <Link to="/app/store"
          className="flex items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-secondary p-4 shadow-lg shadow-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold">المتجر</div>
              <div className="text-[11px] text-muted-foreground">شارات • ألوان • مؤثرات</div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground rtl:rotate-180" />
        </Link>

        <Section title={t("settings.theme")}>
          <button onClick={toggle} className="flex w-full items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span className="font-medium">{theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
            </div>
          </button>
        </Section>

        <Section title={t("settings.language")}>
          <button onClick={() => setShowLang(true)} className="flex w-full items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5" />
              <span className="font-medium">{t("settings.language")}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {currentLang.name}
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </div>
          </button>
        </Section>

        <button
          onClick={handleLogout}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </button>
      </div>

      {showLang && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowLang(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="mb-3 text-lg font-bold">{t("settings.language")}</h2>
            <ul className="flex flex-col">
              {SUPPORTED_LANGUAGES.map((l) => {
                const active = i18n.language === l.code;
                return (
                  <li key={l.code}>
                    <button
                      onClick={() => { i18n.changeLanguage(l.code); setShowLang(false); }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-start hover:bg-secondary"
                      dir={l.dir}
                    >
                      <span className="font-medium">{l.name}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}
