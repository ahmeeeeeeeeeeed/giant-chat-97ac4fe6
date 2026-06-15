import { useEffect, useState } from "react";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { getOnline } from "@/lib/use-online";

type CachedMedia = Blob | string;

function isBlob(value: CachedMedia | null): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

/**
 * Local-first media source for APK/offline use.
 * Reads the saved Blob from IndexedDB first, then refreshes it from network
 * when online. If the network fails, the previous local Blob stays visible.
 */
export function useCachedMediaSource(url: string | null | undefined): string | null {
  const [source, setSource] = useState<string | null>(url ?? null);

  useEffect(() => {
    if (!url) {
      setSource(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setSource(url);

    const setFromCached = (cached: CachedMedia) => {
      if (cancelled) return;
      if (isBlob(cached)) {
        objectUrl = URL.createObjectURL(cached);
        setSource(objectUrl);
      } else {
        setSource(cached);
      }
    };

    (async () => {
      const key = cacheKeys.media(url);
      const cached = await cacheGet<CachedMedia>(key);
      if (cached) {
        console.info("[media-cache] loaded-local", { key, online: getOnline() });
        setFromCached(cached);
      }

      if (!getOnline()) return;

      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob.size) return;
        await cacheSet(key, blob);
        console.info("[media-cache] saved-local", { key, bytes: blob.size });
        if (!cancelled && !cached) setFromCached(blob);
      } catch {
        // Keep the cached source or original URL; never surface a network toast.
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return source;
}