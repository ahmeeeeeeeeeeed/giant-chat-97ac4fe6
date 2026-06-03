import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useIsAdmin, useUnreadDMCount } from "@/lib/use-admin";
import { Home, MessageSquare, User, Settings, Users as UsersIcon, Gamepad2, Bell, Shield } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { isAdmin } = useIsAdmin();
  const unread = useUnreadDMCount();

  const tabs = [
    { to: "/app", label: t("nav.rooms"), icon: Home, exact: true },
    { to: "/app/friends", label: t("nav.friends"), icon: UsersIcon, exact: false },
    { to: "/app/games", label: t("nav.games"), icon: Gamepad2, exact: false },
    { to: "/app/chats", label: t("nav.chats"), icon: MessageSquare, exact: false },
    { to: "/app/profile", label: t("nav.profile"), icon: User, exact: false },
    { to: "/app/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ] as const;

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span aria-label="loading" className="block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const path = location.pathname;
  const hideChrome = /\/app\/rooms\/[^/]+/.test(path) || /\/app\/chats\/[^/]+/.test(path);

  return (
    <div className={`flex min-h-screen flex-col ${hideChrome ? "" : "pb-[72px]"}`}>
      {!hideChrome && (
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
          <div className="text-sm font-extrabold tracking-tight">Giant</div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/app/admin" aria-label={t("admin.title")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link to="/app/notifications" aria-label={t("notif.title")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -end-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}
      <Outlet />
      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <ul className="mx-auto flex max-w-md items-stretch justify-around">
            {tabs.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className={`relative flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground" />}
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    <span>{label}</span>
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
