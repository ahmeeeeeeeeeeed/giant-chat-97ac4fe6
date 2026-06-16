import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Giant Android APK.
 *
 * Strategy:
 *  - `webDir` points to Vite's static build output (`dist/`).
 *  - All files in `public/` (including the bundled video & poster) are copied
 *    into `dist/` by Vite, then into `android/app/src/main/assets/public/`
 *    by `npx cap sync`. They load from local storage — no internet needed.
 *  - `server.url` is intentionally NOT set: we want the APK to load the
 *    bundled SPA, not a remote URL.
 *  - `androidScheme: 'https'` so Supabase/Service-Workers behave like web.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.giant",
  appName: "Giant",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
    // Allow loading remote chat assets (images, audio, video from Supabase / CDN)
    allowNavigation: [
      "*.supabase.co",
      "*.lovable.app",
      "*.lovableproject.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0b0b0f",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
