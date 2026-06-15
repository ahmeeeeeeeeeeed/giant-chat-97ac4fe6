// Offline-first key-value cache.
// Web: IndexedDB. Native APK: IndexedDB + app-private Filesystem mirror,
// because mobile WebView storage can be evicted while app data files persist.
// Safe to import from client components; no-ops gracefully on the server.
import { get, set, del, createStore } from "idb-keyval";

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";

const store = isBrowser ? createStore("giant-offline", "kv") : null;
const nativePrefix = "giant.offline.v2:";

type Entry<T> = { v: T; t: number };

async function getNativeFilesystem() {
  if (typeof window === "undefined") return null;
  try {
    const [{ Capacitor }, fs] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/filesystem"),
    ]);
    return Capacitor.isNativePlatform() ? fs : null;
  } catch {
    return null;
  }
}

function nativePath(key: string): string {
  const encoded = btoa(key).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `offline-cache/${encoded}.json`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const type = /data:(.*?);base64/.exec(meta)?.[1] ?? "application/octet-stream";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function nativeGet<T>(key: string): Promise<Entry<T> | null> {
  const fs = await getNativeFilesystem();
  if (!fs) return null;
  try {
    const { data } = await fs.Filesystem.readFile({
      path: nativePath(key),
      directory: fs.Directory.Data,
      encoding: fs.Encoding.UTF8,
    });
    const raw = JSON.parse(String(data)) as
      | { t: number; kind: "blob"; dataUrl: string }
      | { t: number; kind: "json"; v: T };
    if (raw.kind === "blob") {
      return { t: raw.t, v: dataUrlToBlob(raw.dataUrl) as T };
    }
    return { t: raw.t, v: raw.v };
  } catch {
    return null;
  }
}

async function nativeSet<T>(key: string, entry: Entry<T>): Promise<void> {
  const fs = await getNativeFilesystem();
  if (!fs) return;
  try {
    const payload =
      typeof Blob !== "undefined" && entry.v instanceof Blob
        ? { t: entry.t, kind: "blob" as const, dataUrl: await blobToDataUrl(entry.v) }
        : { t: entry.t, kind: "json" as const, v: entry.v };
    await fs.Filesystem.writeFile({
      path: nativePath(key),
      data: JSON.stringify(payload),
      directory: fs.Directory.Data,
      encoding: fs.Encoding.UTF8,
      recursive: true,
    });
    console.info("[offline-cache] saved-native", { key });
  } catch {
    /* Native file write failed — IndexedDB path remains available */
  }
}

async function nativeDel(key: string): Promise<void> {
  const fs = await getNativeFilesystem();
  if (!fs) return;
  try {
    await fs.Filesystem.deleteFile({ path: nativePath(key), directory: fs.Directory.Data });
  } catch {
    /* ignore */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!store) return (await nativeGet<T>(key))?.v ?? null;
  try {
    const raw = (await get<Entry<T>>(key, store)) ?? null;
    if (raw) return raw.v;
  } catch {
    /* fall back to native mirror */
  }
  const native = await nativeGet<T>(key);
  if (!native) return null;
  try {
    await set(key, native, store);
  } catch {
    /* ignore */
  }
  console.info("[offline-cache] loaded-native", { key });
  return native.v;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const entry = { v: value, t: Date.now() } satisfies Entry<T>;
  if (store) {
    try {
      await set(key, entry, store);
    } catch {
      /* quota or private mode — native mirror may still work */
    }
  }
  await nativeSet(key, entry);
}

export async function cacheDel(key: string): Promise<void> {
  try {
    if (store) await del(key, store);
  } catch {
    /* ignore */
  }
  await nativeDel(key);
}

/**
 * Read-through cache helper. Returns cached value immediately if any,
 * then in background tries to fetch fresh data and updates the cache.
 * The fetcher result is returned when network succeeds; otherwise the
 * cached value (or null) is returned.
 */
export async function readThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T | null; fromCache: boolean }> {
  const cached = await cacheGet<T>(key);
  try {
    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) await cacheSet(key, fresh);
    return { data: fresh, fromCache: false };
  } catch {
    return { data: cached, fromCache: true };
  }
}

export const cacheKeys = {
  profile: (userId: string) => `profile:${userId}`,
  friends: (userId: string) => `friends:${userId}`,
  friendProfiles: (userId: string) => `friend-profiles:${userId}`,
  roomsList: () => `rooms:list`,
  chatsList: (userId: string) => `chats:list:${userId}`,
  dmMessages: (userId: string, otherId: string) => `dm:${userId}:${otherId}`,
  media: (url: string) => `media:${url}`,
  roomMessages: (roomId: string) => `room-msgs:${roomId}`,
  settings: (userId: string) => `settings:${userId}`,
};
