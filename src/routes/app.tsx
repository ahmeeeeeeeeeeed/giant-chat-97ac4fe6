import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Home, MessageSquare, User, Settings, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { to: "/app", label: t("nav.rooms"), icon: Home, exact: true },
    { to: "/app/friends", label: t("nav.friends"), icon: UsersIcon, exact: false },
    { to: "/app/chats", label: t("nav.chats"), icon: MessageSquare, exact: false },
    { to: "/app/profile", label: t("nav.profile"), icon: User, exact: false },
    { to: "/app/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ] as const;

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{t("auth.loading")}</div>;
  }

  const path = location.pathname;
  const hideNav = /\/app\/rooms\/[^/]+/.test(path) || /\/app\/chats\/[^/]+/.test(path);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-[72px]">
      <Outlet />
      {!hideNav && (
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
