import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ExitConfirmDialog } from "@/components/ExitConfirmDialog";
import { PageTransition } from "@/components/PageTransition";
import { UpdateGate } from "@/components/UpdateGate";
import i18n, { applyLanguageDir } from "@/lib/i18n";
import { setAutoTranslateLanguage } from "@/lib/auto-translate";
import { registerAppServiceWorker } from "@/lib/register-sw";
import { schedulePrewarm } from "@/lib/prewarm";
import { initCapacitorChrome } from "@/lib/capacitor-init";
import { notifyNativeUpdateReady, syncNativeInstalledVersion } from "@/lib/app-update";
import { CallProvider } from "@/lib/use-calls";
import { CallOverlay } from "@/components/CallOverlay";

import appCss from "../styles.css?url";
import welcomeBg from "@/assets/welcome-bg.png.asset.json";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">404</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {t("common.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("common.error")}</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" },
      { title: "Giant — دردشة مجتمعات وغرف" },
      { name: "description", content: "Giant: غرف دردشة مجتمعات ومحادثات خاصة فورية." },
      { name: "theme-color", content: "#10b981" },
      { name: "color-scheme", content: "dark light" },
      { name: "application-name", content: "Giant" },
      // iOS PWA / WebView chrome
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Giant" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      // Android
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "Giant — دردشة مجتمعات وغرف" },
      { property: "og:description", content: "Giant: غرف دردشة مجتمعات ومحادثات خاصة فورية." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Giant" },
      { name: "google-site-verification", content: "2vf6z8pDOFFfBBBw-WbJK9a9O33Fst_FFTnhInQOsuQ" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Preload the welcome background image so it's ready before the route mounts
      { rel: "preload", as: "image", href: welcomeBg.url, type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      // Speed: warm up critical origins before first paint
      { rel: "preconnect", href: "https://gfuusohydgpumgardbyn.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://gfuusohydgpumgardbyn.supabase.co" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function LanguageSync() {
  useEffect(() => {
    applyLanguageDir(i18n.language);
    setAutoTranslateLanguage(i18n.language);
    const onChange = (lng: string) => {
      applyLanguageDir(lng);
      setAutoTranslateLanguage(lng);
    };
    i18n.on("languageChanged", onChange);
    return () => { i18n.off("languageChanged", onChange); };
  }, []);
  useEffect(() => {
    void notifyNativeUpdateReady();
    void syncNativeInstalledVersion();
    registerAppServiceWorker();
    schedulePrewarm();
    initCapacitorChrome();
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CallProvider>
            <LanguageSync />
            <PageTransition>
              <Outlet />
            </PageTransition>
            <UpdateGate />
            <Toaster position="top-center" richColors />
            <ExitConfirmDialog />
            <CallOverlay />
          </CallProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
