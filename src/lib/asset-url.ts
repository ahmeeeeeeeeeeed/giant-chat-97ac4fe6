// Returns an absolute URL for Lovable CDN assets when the app is running
// outside a Lovable-hosted origin (e.g. inside the Capacitor APK at
// https://localhost, or any non-lovable host). The CDN serves `/__l5e/...`
// only from Lovable origins, so origin-relative paths break inside the APK.
//
// On Lovable origins (preview / published / custom domain) we keep the
// relative path so the browser fetches from the same host.
const CDN_HOST = "https://giant-chat.lovable.app";

export function assetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  const host = window.location.hostname;
  const isLovable = host.endsWith(".lovable.app") || host.endsWith(".lovable.dev");
  if (isLovable) return url;
  // Native APK (https://localhost), file://, or any other host → absolute CDN URL.
  return CDN_HOST + url;
}
