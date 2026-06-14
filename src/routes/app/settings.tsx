import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import { signOut, useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/use-admin";
import {
  Moon, Sun, LogOut, ChevronLeft, Globe, Check,
  ShoppingBag, Flag, User, Bell, Users as UsersIcon,
  Trophy, MessageSquare, Shield, Info, HelpCircle,
  Star, Share2, Lock, Newspaper, Gamepad2,
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { findAdminId } from "@/lib/find-admin";
import { APP_VERSION } from "@/lib/version";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [showLang, setShowLang] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const doLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/" });
    } finally {
      setSigningOut(false);
    }
  };

  const openReports = async () => {
    const id = await findAdminId();
    if (!id) { toast.error("لم يتم العثور على حساب الإدارة"); return; }
    navigate({ to: "/app/chats/$id", params: { id } });
  };

  const share = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "Giant Chat", url });
      else { await navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }
    } catch {}
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <main className="flex flex-1 flex-col bg-gradient-to-b from-background to-secondary/30 pb-8">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("settings.title")}</h1>
        {user?.email && <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{user.email}</p>}
      </header>

      <div className="flex flex-col gap-4 px-4 py-5">
        {/* Featured */}
        <div className="grid grid-cols-2 gap-3">
          <FeatureTile to="/app/store" icon={ShoppingBag} title="المتجر" subtitle="شارات • مؤثرات"
            gradient="from-violet-500 via-fuchsia-500 to-pink-500" />
          <FeatureTile to="/app/achievements" icon={Trophy} title="الإنجازات" subtitle="ترتيب أسبوعي"
            gradient="from-amber-400 via-orange-500 to-rose-500" />
        </div>

        {/* Account */}
        <Section title="الحساب">
          <Row to="/app/my_profile" icon={User} label="ملفي الشخصي" />
          <Row to="/app/account" icon={Lock} label="إدارة الحساب وكلمة السر" />
          <Row to="/app/notifications" icon={Bell} label={t("notif.title")} />
        </Section>

        {/* Social */}
        <Section title="التواصل">
          <Row to="/app/friends" icon={UsersIcon} label={t("nav.friends")} />
          <Row to="/app/chats" icon={MessageSquare} label={t("nav.chats")} />
          <Row to="/app/community" icon={Newspaper} label="المجتمع" />
          <Row to="/app/games" icon={Gamepad2} label={t("nav.games")} />
        </Section>

        {/* Preferences */}
        <Section title="التفضيلات">
          <button onClick={toggle} className="flex w-full items-center justify-between p-4 active:bg-secondary/60">
            <div className="flex items-center gap-3">
              <IconBox color={theme === "dark" ? "bg-indigo-500" : "bg-amber-500"}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </IconBox>
              <span className="font-medium">{theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">اضغط للتبديل</span>
          </button>
          <button onClick={() => setShowLang(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60">
            <div className="flex items-center gap-3">
              <IconBox color="bg-emerald-500"><Globe className="h-4 w-4" /></IconBox>
              <span className="font-medium">{t("settings.language")}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {currentLang.name}
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </div>
          </button>
        </Section>

        {/* Support */}
        <Section title="الدعم والمساعدة">
          <button onClick={openReports} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-orange-500"><Flag className="h-4 w-4" /></IconBox>
              <span className="font-medium">الإبلاغ والشكاوى</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={share} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-sky-500"><Share2 className="h-4 w-4" /></IconBox>
              <span className="font-medium">شارك التطبيق</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={() => toast.success("شكراً لتقييمك ⭐")} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-yellow-500"><Star className="h-4 w-4" /></IconBox>
              <span className="font-medium">قيّم التطبيق</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={() => toast.info("صفحة المساعدة قريبًا")} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-teal-500"><HelpCircle className="h-4 w-4" /></IconBox>
              <span className="font-medium">المساعدة والأسئلة الشائعة</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={() => toast.info("Giant Chat v1.0.0")} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-slate-500"><Info className="h-4 w-4" /></IconBox>
              <span className="font-medium">عن التطبيق</span>
            </div>
            <span className="text-[11px] text-muted-foreground">v1.0.0</span>
          </button>
        </Section>

        {isAdmin && (
          <Section title="الإدارة">
            <Row to="/app/admin" icon={Shield} label="لوحة التحكم" />
          </Section>
        )}

        <button
          onClick={() => setShowLogout(true)}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 font-semibold text-destructive active:scale-[0.99] transition"
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </button>
      </div>

      {/* Logout confirm */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5" onClick={() => !signingOut && setShowLogout(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold">تأكيد تسجيل الخروج</h2>
            <p className="mb-4 text-sm text-muted-foreground">هل تريد تسجيل الخروج من حسابك؟</p>
            <div className="flex gap-2">
              <button disabled={signingOut} onClick={() => setShowLogout(false)}
                className="h-11 flex-1 rounded-xl border border-input font-semibold">إلغاء</button>
              <button disabled={signingOut} onClick={doLogout}
                className="h-11 flex-1 rounded-xl bg-destructive text-destructive-foreground font-semibold disabled:opacity-60">
                {signingOut ? "..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language picker */}
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

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow ${color}`}>
      {children}
    </div>
  );
}

function Row({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to as any} className="flex items-center justify-between p-4 active:bg-secondary/60">
      <div className="flex items-center gap-3">
        <IconBox color="bg-primary"><Icon className="h-4 w-4" /></IconBox>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
    </Link>
  );
}

function FeatureTile({ to, icon: Icon, title, subtitle, gradient }: {
  to: string; icon: any; title: string; subtitle: string; gradient: string;
}) {
  return (
    <Link to={to as any} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg active:scale-[0.98] transition`}>
      <div className="absolute -end-4 -top-4 h-20 w-20 rounded-full bg-white/15 blur-xl" />
      <Icon className="h-6 w-6 mb-2 drop-shadow" />
      <div className="text-base font-extrabold leading-tight">{title}</div>
      <div className="text-[11px] opacity-90">{subtitle}</div>
    </Link>
  );
}
