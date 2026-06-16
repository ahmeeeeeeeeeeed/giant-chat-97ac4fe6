import { useEffect, useState, useSyncExternalStore } from "react";
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
  expires_at: string;
};

export async function fetchUserStories(userId: string): Promise<StoryRow[]> {
  const { data } = await (supabase as any).rpc("get_user_stories", { _user: userId });
  return (data as StoryRow[]) || [];
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

export async function deleteStory(storyId: string) {
  const { error } = await (supabase as any).from("stories").delete().eq("id", storyId);
  if (error) throw error;
  void fetchActiveStories(true);
}

export function useStoriesAutoRefresh(intervalMs = 60_000) {
  useEffect(() => {
    void fetchActiveStories(true);
    const t = setInterval(() => fetchActiveStories(true), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}
