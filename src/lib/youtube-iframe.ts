// YouTube IFrame Player API loader — single shared script.
// Returns a Promise that resolves to the global `YT` namespace once ready.
let ytReady: Promise<typeof window extends { YT: infer T } ? T : any> | null = null;

export function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no_window"));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch { /* ignore */ }
      resolve(w.YT);
    };
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existing) {
      // wait for callback
      const tm = setTimeout(() => reject(new Error("yt_api_timeout")), 15000);
      const orig = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { clearTimeout(tm); try { orig?.(); } catch {/*ignore*/} resolve(w.YT); };
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("yt_api_load_failed"));
    document.head.appendChild(s);
  });
  return ytReady;
}
