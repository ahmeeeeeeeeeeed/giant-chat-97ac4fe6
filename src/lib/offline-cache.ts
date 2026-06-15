// Offline-first key-value cache.
// Web: IndexedDB. Native APK: IndexedDB + Capacitor Preferences mirror for
// JSON chat data, because WebView IndexedDB can be evicted on mobile devices.
// Safe to import from client components; no-ops gracefully on the server.
import { get, set, del, createStore } from "idb-keyval";

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";

const store = isBrowser ? createStore("giant-offline", "kv") : null;
const nativePrefix = "giant.offline.v2:";

type Entry<T> = { v: T; t: number };

async function getNativePreferences() {
  if (typeof window === "undefined") return null;
  try {
    const [{ Capacitor }, { Preferences }] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/preferences"),
    ]);
    return Capacitor.isNativePlatform() ? Preferences : null;
  } catch {
    return null;
  }
}

function canMirrorNative(value: unknown): boolean {
  if (typeof Blob !== "undefined" && value instanceof Blob) return false;
  if (typeof File !== "undefined" && value instanceof File) return false;
  return true;
}

async function nativeGet<T>(key: string): Promise<Entry<T> | null> {
  const Preferences = await getNativePreferences();
  if (!Preferences) return null;
  try {
    const { value } = await Preferences.get({ key: nativePrefix + key });
    return value ? (JSON.parse(value) as Entry<T>) : null;
  } catch {
    return null;
  }
}

async function nativeSet<T>(key: string, entry: Entry<T>): Promise<void> {
  if (!canMirrorNative(entry.v)) return;
  const Preferences = await getNativePreferences();
  if (!Preferences) return;
  try {
    await Preferences.set({ key: nativePrefix + key, value: JSON.stringify(entry) });
    console.info("[offline-cache] saved-native", { key });
  } catch {
    /* SharedPreferences quota/serialization — IndexedDB path remains available */
  }
}

async function nativeDel(key: string): Promise<void> {
  const Preferences = await getNativePreferences();
  if (!Preferences) return;
  try { await Preferences.remove({ key: nativePrefix + key }); } catch { /* ignore */ }
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
  try { await set(key, native, store); } catch { /* ignore */ }
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
