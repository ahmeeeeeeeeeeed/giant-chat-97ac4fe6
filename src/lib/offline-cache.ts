// Lightweight IndexedDB key-value cache with TTL for offline-first reads.
// Safe to import from client components; no-ops gracefully on the server.
import { get, set, del, createStore } from "idb-keyval";

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";

const store = isBrowser ? createStore("giant-offline", "kv") : null;

type Entry<T> = { v: T; t: number };

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!store) return null;
  try {
    const raw = (await get<Entry<T>>(key, store)) ?? null;
    return raw ? raw.v : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  if (!store) return;
  try {
    await set(key, { v: value, t: Date.now() } satisfies Entry<T>, store);
  } catch {
    /* quota or private mode — ignore */
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!store) return;
  try {
    await del(key, store);
  } catch {
    /* ignore */
  }
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
  roomMessages: (roomId: string) => `room-msgs:${roomId}`,
  settings: (userId: string) => `settings:${userId}`,
};
