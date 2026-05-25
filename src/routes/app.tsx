import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Home, MessageSquare, User, Settings } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const tabs = [
  { to: "/app", label: "الغرف", icon: Home, exact: true },
  { to: "/app/chats", label: "المحادثات", icon: MessageSquare, exact: false },
  { to: "/app/profile", label: "حسابي", icon: User, exact: false },
  { to: "/app/settings", label: "الإعدادات", icon: Settings, exact: false },
] as const;

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">جاري التحميل…</div>;
  }

  // Hide bottom nav inside individual room/chat screens
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
                    className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
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
