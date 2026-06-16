import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StoryUser = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  equipped_frame: string | null;
  story_count: number;
  latest_at: string;
  has_unseen: boolean;
};

let cache: StoryUser[] = [];
let cacheAt = 0;
let inflight: Promise<StoryUser[]> | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export async function fetchActiveStories(force = false): Promise<StoryUser[]> {
  const fresh = Date.now() - cacheAt < 30_000;
  if (!force && fresh && cache.length >= 0) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await (supabase as any).rpc("get_active_stories");
    if (error) { inflight = null; return cache; }
    cache = (data as StoryUser[]) || [];
    cacheAt = Date.now();
    inflight = null;
    emit();
    return cache;
  })();
  return inflight;
}

export function useActiveStories() {
  const data = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => cache,
    () => cache,
  );
  useEffect(() => { void fetchActiveStories(); }, []);
  return data;
}

export function useUserHasStory(userId?: string | null) {
  const list = useActiveStories();
  if (!userId) return false;
  return list.some((u) => u.user_id === userId);
}

export type StoryRow = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  background: string | null;
  created_at: string;
  updated_at?: string;
  expires_at: string;
  is_hidden?: boolean;
};

// ---------- Local cache (per-user stories) ----------
const LS_PREFIX = "stories_cache:v1:";
const LS_TTL_MS = 60 * 60 * 1000; // 1h soft TTL; expiry of stories themselves is checked too

type CacheEntry = { at: number; updatedKey: string; data: StoryRow[] };

function readLS(userId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + userId);
    if (!raw) return null;
    const v = JSON.parse(raw) as CacheEntry;
    if (!v?.data) return null;
    return v;
  } catch { return null; }
}
function writeLS(userId: string, data: StoryRow[]) {
  try {
    const updatedKey = data.map((s) => `${s.id}:${s.updated_at || s.created_at}`).join("|");
    const entry: CacheEntry = { at: Date.now(), updatedKey, data };
    localStorage.setItem(LS_PREFIX + userId, JSON.stringify(entry));
  } catch { /* quota */ }
}
export function invalidateStoryCache(userId?: string) {
  try {
    if (userId) localStorage.removeItem(LS_PREFIX + userId);
    else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
      }
    }
  } catch { /* ignore */ }
}

export function getCachedUserStories(userId: string): StoryRow[] | null {
  const v = readLS(userId);
  if (!v) return null;
  // Filter out anything that's already expired
  const now = Date.now();
  const valid = v.data.filter((s) => new Date(s.expires_at).getTime() > now);
  return valid.length ? valid : null;
}

export async function fetchUserStories(userId: string, opts?: { force?: boolean }): Promise<StoryRow[]> {
  const { data } = await (supabase as any).rpc("get_user_stories", { _user: userId });
  const fresh = ((data as StoryRow[]) || []);
  writeLS(userId, fresh);
  return fresh;
}

export async function viewStory(storyId: string) {
  await (supabase as any).rpc("view_story", { _story: storyId });
}

export async function publishStory(args: {
  content?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  background?: string | null;
}) {
  const { data, error } = await (supabase as any).rpc("publish_story", {
    _content: args.content ?? null,
    _media_url: args.media_url ?? null,
    _media_type: args.media_type ?? null,
    _background: args.background ?? null,
  });
  if (error) throw error;
  void fetchActiveStories(true);
  return data as string;
}

export async function editStory(args: {
  id: string;
  content?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  background?: string | null;
}) {
  const { error } = await (supabase as any).rpc("edit_story", {
    _story: args.id,
    _content: args.content ?? null,
    _media_url: args.media_url ?? null,
    _media_type: args.media_type ?? null,
    _background: args.background ?? null,
  });
  if (error) throw error;
  invalidateStoryCache();
  void fetchActiveStories(true);
}

export async function deleteStory(storyId: string) {
  const { error } = await (supabase as any).from("stories").delete().eq("id", storyId);
  if (error) throw error;
  invalidateStoryCache();
  void fetchActiveStories(true);
}

export function useStoriesAutoRefresh(intervalMs = 60_000) {
  useEffect(() => {
    void fetchActiveStories(true);
    const t = setInterval(() => fetchActiveStories(true), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

export type StoryReactionAgg = { emoji: string; count: number; mine: boolean };

export async function getStoryReactions(storyId: string): Promise<StoryReactionAgg[]> {
  const { data } = await (supabase as any).rpc("get_story_reactions", { _story: storyId });
  return ((data as any[]) || []).map((r) => ({ emoji: r.emoji, count: Number(r.count), mine: !!r.mine }));
}

export async function reactToStory(storyId: string, emoji: string) {
  const { error } = await (supabase as any).rpc("react_to_story", { _story: storyId, _emoji: emoji });
  if (error) throw error;
}

export async function unreactToStory(storyId: string) {
  const { error } = await (supabase as any).rpc("unreact_to_story", { _story: storyId });
  if (error) throw error;
}

export async function commentOnStory(storyId: string, text: string) {
  const { error } = await (supabase as any).rpc("comment_on_story", { _story: storyId, _text: text });
  if (error) throw error;
}

