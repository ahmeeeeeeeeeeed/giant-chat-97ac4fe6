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
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
  },
};

export default config;
