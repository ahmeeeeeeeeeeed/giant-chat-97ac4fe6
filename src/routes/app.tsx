import { createFileRoute, Link, Outlet, useNavigate, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useIsAdmin, useUnreadDMCount } from "@/lib/use-admin";
import { useGlobalNotificationListener, useUnreadRoomCount } from "@/lib/use-global-notifications";
import { Home, MessageSquare, User, Settings, Users as UsersIcon, Gamepad2, Bell, Shield, Flag, ArrowRight, Newspaper } from "lucide-react";
import { OnlineStatusBanner } from "@/components/OnlineStatusBanner";
import { ReportModal } from "@/components/ReportModal";
import { scheduleDataPrewarm } from "@/lib/data-prewarm";
import giantLogo from "@/assets/giant-logo.png.asset.json";

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
  const unread = unreadDM + unreadRooms;
  useGlobalNotificationListener((url) => navigate({ to: url as any }));

  const tabs = [
    { to: "/app", label: t("nav.rooms"), icon: Home, exact: true },
    { to: "/app/community", label: "المجتمع", icon: Newspaper, exact: false },
    { to: "/app/friends", label: t("nav.friends"), icon: UsersIcon, exact: false },
    { to: "/app/games", label: t("nav.games"), icon: Gamepad2, exact: false },
    { to: "/app/chats", label: t("nav.chats"), icon: MessageSquare, exact: false },
    { to: "/app/my_profile", label: t("nav.profile"), icon: User, exact: false },
    { to: "/app/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ] as const;

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session?.user?.id) scheduleDataPrewarm(session.user.id);
  }, [session?.user?.id]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span aria-label="loading" className="block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const path = location.pathname;
  const hideChrome = /\/app\/rooms\/[^/]+/.test(path) || /\/app\/chats\/[^/]+/.test(path);
  const tabRoots = new Set(["/app", "/app/community", "/app/friends", "/app/games", "/app/chats", "/app/my_profile", "/app/settings"]);
  const showBack = !hideChrome && !tabRoots.has(path);
  const router = useRouter();

  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className={`flex min-h-screen flex-col ${hideChrome ? "" : "pb-[calc(72px+env(safe-area-inset-bottom))]"}`}>

      <OnlineStatusBanner />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
      {!hideChrome && (
        <header className="sticky top-0 z-50 pt-[env(safe-area-inset-top)] bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-600/95 text-white shadow-[0_8px_24px_-12px_rgba(6,78,59,0.55)]">
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-md shadow-emerald-900/30 ring-1 ring-white/40">
                  <img src={giantLogo.url} alt="Giant" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold leading-tight tracking-tight">Giant</div>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-100/80">chat · مجتمعات</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setReportOpen(true)}
                aria-label="الإبلاغ والشكاوى"
                title="الإبلاغ والشكاوى"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md shadow-orange-900/30 ring-1 ring-white/30 transition active:scale-95 hover:brightness-110"
              >
                <Flag className="h-[18px] w-[18px]" />
              </button>
              {isAdmin && (
                <Link to="/app/admin" aria-label={t("admin.title")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur transition active:scale-95 hover:bg-white/20">
                  <Shield className="h-[18px] w-[18px]" />
                </Link>
              )}
              <Link to="/app/notifications" aria-label={t("notif.title")}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur transition active:scale-95 hover:bg-white/20">
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-emerald-600">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </div>
          </div>
          {/* subtle bottom accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </header>
      )}
      <Outlet />
      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))]">
          <ul className="mx-auto flex max-w-md items-stretch justify-around rounded-[28px] border border-white/10 bg-emerald-900/85 px-2 py-2 shadow-[0_20px_50px_-15px_rgba(6,78,59,0.65)] backdrop-blur-xl">
            {tabs.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              const showBadge = to === "/app/chats" && unreadDM > 0;
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className="group relative flex flex-col items-center gap-1 py-1 text-[10px] font-semibold transition"
                  >
                    <span
                      className={`relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${
                        active
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-emerald-300/40 -translate-y-0.5"
                          : "text-emerald-100/80 group-active:scale-90"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                      {showBadge && (
                        <span className="absolute -end-1.5 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-emerald-900">
                          {unreadDM > 99 ? "99+" : unreadDM}
                        </span>
                      )}
                    </span>
                    <span className={`leading-none transition ${active ? "text-white" : "text-emerald-100/70"}`}>{label}</span>
                    {active && (
                      <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_6px_2px_rgba(110,231,183,0.6)]" />
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
