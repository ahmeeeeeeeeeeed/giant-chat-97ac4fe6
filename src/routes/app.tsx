import { createFileRoute, Link, Outlet, useNavigate, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useIsAdmin, useUnreadDMCount } from "@/lib/use-admin";
import { Home, MessageSquare, User, Settings, Users as UsersIcon, Gamepad2, Bell, Shield, Flag, ArrowRight, Newspaper } from "lucide-react";
import { findAdminId } from "@/lib/find-admin";
import { toast } from "sonner";
import { OnlineStatusBanner } from "@/components/OnlineStatusBanner";
import { scheduleDataPrewarm } from "@/lib/data-prewarm";

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

  const openComplaints = async () => {
    const id = await findAdminId();
    if (!id) { toast.error("لم يتم العثور على حساب الإدارة"); return; }
    navigate({ to: "/app/chats/$id", params: { id } });
  };

  return (
    <div className={`flex min-h-screen flex-col ${hideChrome ? "" : "pb-[72px]"}`}>
      <OnlineStatusBanner />
      {/* Persistent floating Complaints button — shows everywhere inside the app */}
      <button
        onClick={openComplaints}
        aria-label="الشكاوى والاقتراحات"
        title="الشكاوى والاقتراحات"
        className="fixed bottom-24 end-3 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl shadow-orange-500/40 ring-2 ring-background transition active:scale-95"
      >
        <Flag className="h-5 w-5" />
      </button>
      {!hideChrome && (
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-emerald-700/40 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 shadow-md">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => { try { router.history.back(); } catch { navigate({ to: "/app" }); } }}
                aria-label="رجوع"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
            <div className="text-sm font-extrabold tracking-tight">Giant</div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/app/admin" aria-label={t("admin.title")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link to="/app/notifications" aria-label={t("notif.title")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition">
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
        <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2">
          <ul className="mx-auto flex max-w-md items-stretch justify-around rounded-3xl bg-gradient-to-r from-emerald-600 to-green-600 px-1.5 py-1.5 shadow-2xl shadow-emerald-900/30 ring-1 ring-white/10">
            {tabs.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              const showBadge = to === "/app/chats" && unread > 0;
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold transition ${
                      active ? "bg-white text-emerald-700 shadow-lg" : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                      {showBadge && (
                        <span className="absolute -end-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-1 ring-white/40">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
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
