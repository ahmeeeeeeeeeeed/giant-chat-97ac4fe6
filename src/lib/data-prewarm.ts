// Background data prewarmer.
// On first online session after sign-in (or once per day), silently fetches
// the user's core data (profile, friends, rooms, recent chats, recent
// messages for top chats) and stores it via offline-cache so the app shell
// can render those pages without a network round trip — even pages the user
// has never visited.
import { supabase } from "@/integrations/supabase/client";
import { cacheGet, cacheSet, cacheKeys } from "./offline-cache";
import { getOnline } from "./use-online";
import { previewDMMessage, type DMConversation, type DMRow } from "./dm-delivery";

async function cacheMedia(url: string | null | undefined) {
  if (!url || !getOnline()) return;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return;
    const blob = await response.blob();
    if (blob.size) await cacheSet(cacheKeys.media(url), blob);
  } catch {
    /* media cache is best-effort */
  }
}

const THROTTLE_HOURS = 12;
const RECENT_DM_PEERS_LIMIT = 8;
const MESSAGES_PER_PEER = 50;
type CachedMessageMedia = { media_url?: string | null };

function throttleKey(userId: string) {
  return `giant:data-prewarm:${userId}`;
}

function shouldRun(userId: string): boolean {
  if (typeof window === "undefined") return false;
  if (!getOnline()) return false;
  try {
    const raw = localStorage.getItem(throttleKey(userId));
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last > THROTTLE_HOURS * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function mark(userId: string) {
  try {
    localStorage.setItem(throttleKey(userId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function warmProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio, last_seen_at, created_at, points, gender, country, hide_last_seen, dm_locked, profile_views, equipped_badge, equipped_name_color, equipped_chat_color, equipped_effect, is_banned, is_bot, game_wins")
    .eq("id", userId)
    .maybeSingle();
  if (data) await cacheSet(cacheKeys.profile(userId), data);
}

async function warmFriends(userId: string) {
  const { data } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const list = data ?? [];
  await cacheSet(cacheKeys.friends(userId), list);
  const ids = Array.from(
    new Set(list.flatMap((f) => [f.requester_id, f.addressee_id])),
  );
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", ids);
    const map: Record<string, unknown> = {};
    profs?.forEach((p) => (map[p.id] = p));
    await cacheSet(cacheKeys.friendProfiles(userId), map);
  }
}

async function warmRooms() {
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, description, owner_id")
    .order("created_at", { ascending: false });
  const { data: counts } = await supabase
    .from("room_members")
    .select("room_id");
  const map = new Map<string, number>();
  counts?.forEach((m) => map.set(m.room_id, (map.get(m.room_id) ?? 0) + 1));
  const withCount = (rooms ?? []).map((r) => ({
    ...r,
    member_count: map.get(r.id) ?? 0,
  }));
  await cacheSet(cacheKeys.roomsList(), withCount);
}

async function warmChatsAndRecentMessages(userId: string) {
  const cachedList = (await cacheGet<DMConversation[]>(cacheKeys.chatsList(userId))) ?? [];
  const { data: msgs } = await supabase
    .from("direct_messages")
    .select("sender_id, receiver_id, content, created_at, read_at, message_type")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(300);
  const map = new Map<string, { last: string; created_at: string; unread: number }>();
  (msgs ?? []).forEach((m) => {
    const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    const existing = map.get(otherId);
    const isUnreadForMe = m.receiver_id === userId && !m.read_at;
    if (!existing) {
      map.set(otherId, {
        last: previewDMMessage(m),
        created_at: m.created_at,
        unread: isUnreadForMe ? 1 : 0,
      });
    } else if (isUnreadForMe) {
      existing.unread += 1;
    }
  });
  const ids = Array.from(new Set([...cachedList.map((c) => c.otherId), ...Array.from(map.keys())]));
  if (!ids.length) {
    await cacheSet(cacheKeys.chatsList(userId), []);
    return;
  }
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);
  const out = ids.map((id) => {
    const p = profs?.find((x) => x.id === id);
    const fresh = map.get(id);
    const cached = cachedList.find((c) => c.otherId === id);
    const useFreshLast = !!fresh && (!cached || fresh.created_at >= cached.created_at);
    return {
      otherId: id,
      username: p?.username ?? cached?.username ?? "?",
      avatar_url: p?.avatar_url ?? cached?.avatar_url ?? null,
      last: useFreshLast ? fresh.last : cached?.last ?? fresh?.last ?? "",
      created_at: useFreshLast ? fresh.created_at : cached?.created_at ?? fresh?.created_at ?? new Date(0).toISOString(),
      unread: Math.max(fresh?.unread ?? 0, cached?.unread ?? 0),
    };
  }).filter((c) => c.last).sort((a, b) => b.created_at.localeCompare(a.created_at));
  await cacheSet(cacheKeys.chatsList(userId), out);

  // Pre-cache last N messages for the top recent peers + their profile.
  const topPeers = out
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, RECENT_DM_PEERS_LIMIT);

  await Promise.all(
    topPeers.map(async (peer) => {
      try {
        const [{ data: dm }, { data: prof }] = await Promise.all([
          supabase
            .from("direct_messages")
            .select("*")
            .or(
              `and(sender_id.eq.${userId},receiver_id.eq.${peer.otherId}),and(sender_id.eq.${peer.otherId},receiver_id.eq.${userId})`,
            )
            .order("created_at", { ascending: false })
            .limit(MESSAGES_PER_PEER),
          supabase
            .from("profiles")
            .select(
              "id, username, avatar_url, bio, last_seen_at, created_at, points, gender, country, hide_last_seen, dm_locked, profile_views, equipped_badge, equipped_name_color, equipped_effect, is_banned, is_bot, game_wins",
            )
            .eq("id", peer.otherId)
            .maybeSingle(),
        ]);
        if (dm) {
          const key = cacheKeys.dmMessages(userId, peer.otherId);
          const freshRows = dm as DMRow[];
          const local = (await cacheGet<DMRow[]>(key)) ?? [];
          const byId = new Map<string, DMRow>();
          local.forEach((m) => byId.set(m.id, m));
          freshRows.slice().reverse().forEach((m) => {
            const existing = byId.get(m.id);
            byId.set(m.id, existing ? { ...existing, ...m, created_at: existing.created_at || m.created_at } : m);
          });
          await cacheSet(
            key,
            Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
          );
          await Promise.all((freshRows as CachedMessageMedia[]).map((m) => cacheMedia(m.media_url)));
        }
        if (prof) {
          await cacheSet(cacheKeys.profile(peer.otherId), prof);
          await cacheMedia((prof as { avatar_url?: string | null }).avatar_url);
        }
      } catch {
        /* skip one peer on failure */
      }
    }),
  );
}

let running = false;

async function runOnce(userId: string) {
  if (running) return;
  running = true;
  try {
    await Promise.all([
      warmProfile(userId).catch(() => {}),
      warmFriends(userId).catch(() => {}),
      warmRooms().catch(() => {}),
      warmChatsAndRecentMessages(userId).catch(() => {}),
    ]);
    mark(userId);
  } finally {
    running = false;
  }
}

export function scheduleDataPrewarm(userId: string): void {
  if (!userId) return;
  if (!shouldRun(userId)) return;

  const start = () => {
    if (!getOnline()) return;
    void runOnce(userId);
  };

  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(start, { timeout: 6000 });
  } else {
    setTimeout(start, 3000);
  }
}
