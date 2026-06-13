import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — wraps the published Lovable web app in an Android APK.
// The published URL is loaded directly so that auth, realtime, the service
// worker, and IndexedDB all work exactly like the web app. After the first
// online launch, the PWA service worker caches the shell and data-prewarm
// fills IndexedDB so the app keeps working offline.
const config: CapacitorConfig = {
  appId: "app.lovable.giantchat",
  appName: "Giant",
  webDir: "dist",
  server: {
    url: "https://giant-chat.lovable.app",
    cleartext: false,
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
