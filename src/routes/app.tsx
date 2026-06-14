import { createFileRoute, Link, Outlet, useNavigate, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useIsAdmin, useUnreadDMCount } from "@/lib/use-admin";
import { useGlobalNotificationListener, useUnreadRoomCount } from "@/lib/use-global-notifications";
import { useBellCount } from "@/lib/bell-counter";
import { useAnnouncementsListener } from "@/lib/use-announcements";
import { Home, MessageSquare, User, Settings, Users as UsersIcon, Gamepad2, Bell, Shield, ShieldAlert, Trophy, ArrowRight, Newspaper, Target, Loader2 } from "lucide-react";
import { OnlineStatusBanner } from "@/components/OnlineStatusBanner";
import { ConnectionStatusBadge } from "@/components/ConnectionStatusBadge";
import { ReportModal } from "@/components/ReportModal";
import { UpdateGate } from "@/components/UpdateGate";
import { scheduleDataPrewarm } from "@/lib/data-prewarm";
import { recordDailyAction } from "@/lib/daily-tasks";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { isAdmin } = useIsAdmin();
  const unreadDM = useUnreadDMCount();
  const unreadRooms = useUnreadRoomCount();
  void unreadRooms;
  const bellCount = useBellCount();
  useGlobalNotificationListener((url) => navigate({ to: url as any }));
  useAnnouncementsListener(!!session?.user?.id);
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);

  const tabs = [
    { to: "/app/chats", label: t("nav.chats"), icon: MessageSquare, exact: false },
    { to: "/app/friends", label: t("nav.friends"), icon: UsersIcon, exact: false },
    { to: "/app/community", label: "المجتمع", icon: Newspaper, exact: false },
    { to: "/app/games", label: t("nav.games"), icon: Gamepad2, exact: false },
    { to: "/app", label: t("nav.rooms"), icon: Home, exact: true },
    { to: "/app/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ] as const;


  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session?.user?.id) {
      scheduleDataPrewarm(session.user.id);
      void recordDailyAction("daily_login", 1);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let removeListener: (() => void) | undefined;
    const setup = async () => {
      try {
        const CapApp = await import("@capacitor/app");
        const listener = await CapApp.App.addListener("backButton", ({ canGoBack }) => {
          const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
          // Default landing tab — show exit confirm instead of going back further
          if (currentPath === "/app/chats") {
            window.dispatchEvent(new CustomEvent("giant:exit-confirm"));
            return;
          }
          if (canGoBack) {
            router.history.back();
          } else {
            window.dispatchEvent(new CustomEvent("giant:exit-confirm"));
          }
        });
        removeListener = () => listener.remove();
      } catch {
        // Not running in Capacitor native context
      }
    };
    setup();
    return () => { if (removeListener) removeListener(); };
  }, [router]);


  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span aria-label="loading" className="block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const path = location.pathname;
  const hideChrome = /\/app\/rooms\/[^/]+/.test(path) || /\/app\/chats\/[^/]+/.test(path);
  const tabRoots = new Set(["/app/chats", "/app", "/app/community", "/app/friends", "/app/games", "/app/settings"]);
  const showBack = !hideChrome && !tabRoots.has(path);

  const pageTitle = (() => {
    if (path === "/app" || path === "/app/") return "الغرف";
    if (path === "/app/community") return "المجتمع";
    if (path === "/app/friends") return "الأصدقاء";
    if (path === "/app/games") return "الألعاب";
    if (path === "/app/chats") return "الدردشات";
    if (path.startsWith("/app/chats/")) return "دردشة خاصة";
    if (path === "/app/my_profile") return "حسابي";
    if (path === "/app/settings") return "الإعدادات";
    if (path === "/app/admin") return "لوحة الإدارة";
    if (path.startsWith("/app/admin/")) return "لوحة الإدارة";
    if (path.startsWith("/app/rooms/")) return "الغرفة";
    if (path === "/app/notifications") return "الإشعارات";
    if (path === "/app/achievements") return "الإنجازات";
    if (path === "/app/daily-tasks") return "المهام اليومية";
    if (path === "/app/store") return "المتجر";
    if (path.startsWith("/app/profile/")) return "الملف الشخصي";
    if (path === "/app/create-room") return "إنشاء غرفة";
    if (path === "/app/account") return "إدارة الحساب";
    return "";
  })();

  return (
    <div className={`flex min-h-screen flex-col ${hideChrome ? "" : "pb-[calc(72px+env(safe-area-inset-bottom))]"}`}>

      <OnlineStatusBanner />
      <UpdateGate />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
      {!hideChrome && (
        <header className="sticky top-0 z-50 pt-[env(safe-area-inset-top)] bg-[linear-gradient(180deg,#052e22_0%,#073d2c_60%,#073d2c_100%)] text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] border-b border-emerald-500/15 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-20%,rgba(16,185,129,0.25),transparent_60%)]" />
          <div className="relative flex items-center justify-between px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {showBack ? (
                <button
                  onClick={() => { try { router.history.back(); } catch { navigate({ to: "/app" }); } }}
                  aria-label="رجوع"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur transition active:scale-95 hover:bg-white/20"
                >
                  <ArrowRight className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 p-[2px] shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/30">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-emerald-950/80 backdrop-blur">
                    <span className="text-[18px] font-black leading-none tracking-tight text-emerald-300">G</span>
                  </div>
                  <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-950 shadow-[0_0_8px_2px_rgba(16,185,129,0.6)]" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-[17px] font-extrabold leading-tight tracking-tight text-white">
                    Giant
                  </div>
                  <ConnectionStatusBadge />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-emerald-300/80">
                  <span className="inline-block h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.7)]" />
                  <span className="truncate max-w-[160px]">{pageTitle || "CHAT · مجتمعات"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Link
                to="/app/daily-tasks"
                aria-label="المهام اليومية"
                title="المهام اليومية"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 backdrop-blur transition active:scale-95 hover:bg-emerald-900/60 hover:text-emerald-200"
              >
                <Target className="h-[17px] w-[17px]" />
                <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.6)]" />
              </Link>
              <Link
                to="/app/achievements"
                aria-label="الإنجازات"
                title="الإنجازات الأسبوعية"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 backdrop-blur transition active:scale-95 hover:bg-amber-900/40"
              >
                <Trophy className="h-[17px] w-[17px]" />
              </Link>
              <button
                onClick={() => setReportOpen(true)}
                aria-label="الإبلاغ والشكاوى"
                title="الإبلاغ والشكاوى"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 backdrop-blur transition active:scale-95 hover:bg-rose-900/40"
              >
                <ShieldAlert className="h-[17px] w-[17px]" />
              </button>
              {isAdmin && (
                <Link to="/app/admin" aria-label={t("admin.title")}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-300 backdrop-blur transition active:scale-95 hover:bg-sky-900/40">
                  <Shield className="h-[17px] w-[17px]" />
                </Link>
              )}
              <Link
                to="/app/notifications"
                aria-label="الإشعارات"
                title="الإشعارات"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/60 border border-emerald-500/20 text-emerald-200/90 backdrop-blur transition active:scale-95 hover:bg-slate-800/60"
              >
                <Bell className="h-[17px] w-[17px]" />
                {bellCount > 0 && (
                  <span className="absolute -top-1 -end-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-emerald-950">
                    {bellCount > 99 ? "99+" : bellCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>
      )}
      <Outlet />
      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <ul className="mx-auto flex max-w-md items-stretch justify-around rounded-[24px] border border-emerald-500/15 bg-slate-950/85 px-1.5 py-2 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.6),0_20px_50px_-15px_rgba(6,78,59,0.5)] backdrop-blur-xl">
            {tabs.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              const showBadge = to === "/app/chats" && unreadDM > 0;
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className="group relative flex flex-col items-center gap-1 py-1 text-[10px] font-semibold transition"
                  >
                    {active && (
                      <span aria-hidden className="absolute -top-1 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-emerald-500/30 blur-xl" />
                    )}
                    <span
                      className={`relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${
                        active
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_6px_20px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/50 -translate-y-1"
                          : "text-emerald-200/40 group-hover:text-emerald-200/80 group-active:scale-90"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                      {showBadge && (
                        <span className="absolute -end-1.5 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-950">
                          {unreadDM > 99 ? "99+" : unreadDM}
                        </span>
                      )}
                    </span>
                    <span className={`leading-none transition ${active ? "text-emerald-300 font-bold" : "text-emerald-200/40"}`}>{label}</span>
                    {active && (
                      <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(16,185,129,0.9)]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

    </div>
  );
}
