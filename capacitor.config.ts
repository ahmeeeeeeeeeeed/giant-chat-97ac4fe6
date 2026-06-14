import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — bundles the built web app inside the APK so the WebView
// always has HTML/JS/CSS to render, even with no internet. Network calls
// (Supabase auth/realtime/REST) still happen when online; when offline the
// app reads from IndexedDB / local cache instead of showing the Android
// "ERR_INTERNET_DISCONNECTED" page.
const config: CapacitorConfig = {
  appId: "app.lovable.giantchat",
  appName: "Giant",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0a1a14",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      // Edge-to-edge: WebView fills the entire screen including under the
      // status bar / navigation bar so the in-app header and bottom tab bar
      // appear seamlessly. CSS safe-area-inset-* padding keeps controls
      // tappable.
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
    EdgeToEdge: {
      backgroundColor: "#00000000",
    },
  },
  },
};

export default config;
