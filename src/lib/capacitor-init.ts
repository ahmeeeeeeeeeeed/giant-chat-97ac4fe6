// Runs once on app boot inside the Capacitor APK. On the web this is a no-op
// because the @capacitor/* imports fail silently and the catch block swallows
// them. Goal: edge-to-edge WebView so the in-app header & bottom tab bar fill
// the entire device screen, with the OS status bar overlaying transparently,
// AND requesting the runtime permissions the app needs.
import { requestAllAppPermissions } from "./app-permissions";

let initialized = false;

export async function initCapacitorChrome() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#00000000" });
    } catch { /* plugin not installed yet */ }
    try {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();
    } catch { /* optional */ }
    try {
      const { App } = await import("@capacitor/app");
      const { requestExitConfirm } = await import("@/components/ExitConfirmDialog");
      const ROOT_PATHS = new Set(["/", "/app", "/app/", "/app/index"]);
      await App.addListener("backButton", ({ canGoBack }) => {
        const path = window.location.pathname;
        const atRoot = ROOT_PATHS.has(path);
        // If we have in-app history and we're not at a root page, go back inside the SPA.
        if (!atRoot && (canGoBack || window.history.length > 1)) {
          window.history.back();
          return;
        }
        // At root (or no history): never auto-exit. Show confirm dialog.
        requestExitConfirm();
      });
    } catch { /* App plugin missing */ }
    // Defer permission prompts slightly so the UI shows first.
    setTimeout(() => { void requestAllAppPermissions(); }, 1500);
  } catch {
    // Not running inside Capacitor — ignore.
  }
}

