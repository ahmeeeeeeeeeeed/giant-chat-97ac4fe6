// Runs once on app boot inside the Capacitor APK. On the web this is a no-op
// because the @capacitor/* imports fail silently and the catch block swallows
// them. Goal: edge-to-edge WebView so the in-app header & bottom tab bar fill
// the entire device screen, with the OS status bar overlaying transparently.
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
  } catch {
    // Not running inside Capacitor — ignore.
  }
}
