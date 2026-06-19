// Ephemeral DM delivery: on receiving a message we save it locally, update the
// conversation list cache immediately, then acknowledge delivery. A DB trigger
// may delete the server row after all active recipient devices acknowledge.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOnline, getOnline } from "@/lib/use-online";
import { getDeviceId } from "@/lib/dm-device";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";

export const DM_MESSAGES_EVENT = "giant:dm-message";
export const DM_CONVERSATIONS_EVENT = "giant:dm-conversations-updated";

export type DMRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  message_type: "text" | "image" | "voice" | "system";
  media_url: string | null;
  media_duration_ms: number | null;
  reply_to_id: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
};

export type DMConversation = {
  otherId: string;
  username: string;
  avatar_url: string | null;
  last: string;
  created_at: string;
  unread: number;
};

type ProfileLite = { id: string; username: string | null; avatar_url: string | null };

const cacheLocks = new Map<string, Promise<void>>();

function emitDmEvent(name: string, detail: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function withCacheLock(key: string, task: () => Promise<void>): Promise<void> {
  const previous = cacheLocks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const stored = next.catch(() => undefined);
  cacheLocks.set(key, stored);
  try {
    await next;
  } finally {
    if (cacheLocks.get(key) === stored) cacheLocks.delete(key);
  }
}

export function previewDMMessage(msg: Pick<DMRow, "content" | "message_type">): string {
  if (msg.message_type === "image") return "🖼️ صورة";
  if (msg.message_type === "voice") return "🎙️ رسالة صوتية";
  if (msg.content?.startsWith("🎵TRACK::")) return "🎵 أغنية مشاركة";
  return msg.content || "رسالة جديدة";
}

async function getProfileLite(peerId: string): Promise<ProfileLite | null> {
  const cached = await cacheGet<ProfileLite>(cacheKeys.profile(peerId));
  if (cached?.id) return cached;
  if (!getOnline()) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", peerId)
      .maybeSingle();
    if (error || !data) return null;
    return data as ProfileLite;
  } catch (error) {
    console.warn("[dm-global] profile-load-failed", { peerId, error });
    return null;
  }
}

async function upsertLocalConversation(
  myUserId: string,
  msg: DMRow,
  options: { incrementUnread: boolean } = { incrementUnread: true },
): Promise<void> {
  const peerId = msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;
  const listKey = cacheKeys.chatsList(myUserId);
  const profile = await getProfileLite(peerId);
  let nextList: DMConversation[] = [];
  let updated = undefined as DMConversation | undefined;

  await withCacheLock(listKey, async () => {
    const list = (await cacheGet<DMConversation[]>(listKey)) ?? [];
    const existing = list.find((x) => x.otherId === peerId);
    const isIncomingUnread = msg.receiver_id === myUserId && !msg.read_at;
    const shouldReplaceLast = !existing || msg.created_at >= existing.created_at;
    updated = {
      otherId: peerId,
      username: profile?.username || existing?.username || "?",
      avatar_url: profile?.avatar_url ?? existing?.avatar_url ?? null,
      last: shouldReplaceLast ? previewDMMessage(msg) : existing?.last ?? previewDMMessage(msg),
      created_at: shouldReplaceLast ? msg.created_at : existing?.created_at ?? msg.created_at,
      unread: isIncomingUnread && options.incrementUnread ? (existing?.unread ?? 0) + 1 : existing?.unread ?? 0,
    };
    nextList = [updated, ...list.filter((x) => x.otherId !== peerId)].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    await cacheSet(listKey, nextList);
  });

  console.info("[dm-global] conversation-updated", {
    peerId,
    last: updated?.last,
    unread: updated?.unread,
    total: nextList.length,
  });
  emitDmEvent(DM_CONVERSATIONS_EVENT, { list: nextList, conversation: updated ?? null, message: msg });
}

export async function updateChatsListCache(myUserId: string, msg: DMRow): Promise<void> {
  await upsertLocalConversation(myUserId, msg, { incrementUnread: false });
}

export async function replaceLocalDM(myUserId: string, peerId: string, tempId: string, msg: DMRow): Promise<void> {
  const key = cacheKeys.dmMessages(myUserId, peerId);
  try {
    await withCacheLock(key, async () => {
      const list = (await cacheGet<DMRow[]>(key)) ?? [];
      const withoutTempOrReal = list.filter((m) => m.id !== tempId && m.id !== msg.id);
      const next = [...withoutTempOrReal, msg].sort((a, b) => a.created_at.localeCompare(b.created_at));
      await cacheSet(key, next);
    });
    console.info("[dm-global] replaced-local-message", { key, tempId, messageId: msg.id });
    await upsertLocalConversation(myUserId, msg, { incrementUnread: false });
    emitDmEvent(DM_MESSAGES_EVENT, { message: msg, peerId, wasNew: false, replacedId: tempId });
  } catch (error) {
    console.error("[dm-global] replace-local-message-failed", { key, tempId, messageId: msg.id, error });
  }
}

export async function removeLocalDM(myUserId: string, peerId: string, messageId: string): Promise<void> {
  const key = cacheKeys.dmMessages(myUserId, peerId);
  const listKey = cacheKeys.chatsList(myUserId);
  let remaining: DMRow[] = [];
  try {
    await withCacheLock(key, async () => {
      const list = (await cacheGet<DMRow[]>(key)) ?? [];
      remaining = list.filter((m) => m.id !== messageId);
      await cacheSet(key, remaining);
    });
    const latest = remaining.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (latest) {
      await upsertLocalConversation(myUserId, latest, { incrementUnread: false });
    } else {
      let nextList: DMConversation[] = [];
      await withCacheLock(listKey, async () => {
        const list = (await cacheGet<DMConversation[]>(listKey)) ?? [];
        nextList = list.filter((c) => c.otherId !== peerId);
        await cacheSet(listKey, nextList);
      });
      emitDmEvent(DM_CONVERSATIONS_EVENT, { list: nextList, peerId, removed: true });
    }
    console.info("[dm-global] removed-local-message", { key, messageId, remaining: remaining.length });
  } catch (error) {
    console.error("[dm-global] remove-local-message-failed", { key, messageId, error });
  }
}

/** Register this device for the current user and refresh last_seen. */
export async function registerDevice(userId: string): Promise<void> {
  if (!getOnline()) return;
  const device_id = getDeviceId();
  try {
    await supabase.from("dm_devices").upsert(
      { user_id: userId, device_id, last_seen: new Date().toISOString() },
      { onConflict: "user_id,device_id" },
    );
    console.info("[dm-global] device-registered", { userId, deviceId: device_id });
  } catch (error) {
    console.warn("[dm-global] device-register-failed", { error });
  }
}

/** Append a message to the local conversation cache (idempotent by id). */
export async function appendLocalDM(myUserId: string, msg: DMRow): Promise<boolean> {
  const peerId = msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;
  const key = cacheKeys.dmMessages(myUserId, peerId);
  let wasNew = false;
  let saved: DMRow = msg;
  try {
    await withCacheLock(key, async () => {
      const list = (await cacheGet<DMRow[]>(key)) ?? [];
      const index = list.findIndex((x) => x.id === msg.id);
      if (index >= 0) {
        const copy = [...list];
        copy[index] = { ...copy[index], ...msg };
        saved = copy[index];
        await cacheSet(key, copy.sort((a, b) => a.created_at.localeCompare(b.created_at)));
        return;
      }
      wasNew = true;
      const next = [...list, msg].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const trimmed = next.length > 2000 ? next.slice(next.length - 2000) : next;
      await cacheSet(key, trimmed);
    });
    console.info("[dm-global] saved-local-message", { key, messageId: msg.id, peerId, wasNew });
    await upsertLocalConversation(myUserId, saved, { incrementUnread: wasNew });
    emitDmEvent(DM_MESSAGES_EVENT, { message: saved, peerId, wasNew });
    return wasNew;
  } catch (error) {
    console.error("[dm-global] save-local-message-failed", { key, messageId: msg.id, error });
    return false;
  }
}

/** Mark a previously-saved message as delivered in the local cache. */
export async function markLocalDelivered(myUserId: string, peerId: string, messageId: string): Promise<void> {
  const key = cacheKeys.dmMessages(myUserId, peerId);
  let updated: DMRow | null = null;
  await withCacheLock(key, async () => {
    const list = (await cacheGet<DMRow[]>(key)) ?? [];
    const next = list.map((m) => {
      if (m.id !== messageId || m.delivered_at) return m;
      updated = { ...m, delivered_at: new Date().toISOString() };
      return updated;
    });
    await cacheSet(key, next);
  });
  if (updated) emitDmEvent(DM_MESSAGES_EVENT, { message: updated, peerId, wasNew: false });
}

/** Reset unread state after the user opens/reads a conversation. */
export async function markLocalConversationRead(myUserId: string, peerId: string): Promise<void> {
  const now = new Date().toISOString();
  const listKey = cacheKeys.chatsList(myUserId);
  const dmKey = cacheKeys.dmMessages(myUserId, peerId);
  let nextList: DMConversation[] = [];
  await withCacheLock(listKey, async () => {
    const list = (await cacheGet<DMConversation[]>(listKey)) ?? [];
    nextList = list.map((c) => (c.otherId === peerId ? { ...c, unread: 0 } : c));
    await cacheSet(listKey, nextList);
  });
  await withCacheLock(dmKey, async () => {
    const messages = (await cacheGet<DMRow[]>(dmKey)) ?? [];
    const next = messages.map((m) =>
      m.sender_id === peerId && m.receiver_id === myUserId && !m.read_at
        ? { ...m, read_at: now }
        : m,
    );
    await cacheSet(dmKey, next);
  });
  console.info("[dm-global] conversation-marked-read", { peerId });
  emitDmEvent(DM_CONVERSATIONS_EVENT, { list: nextList, peerId, read: true });
}

/** Acknowledge a list of received messages → server trigger may delete them. */
export async function ackDelivery(userId: string, messageIds: string[]): Promise<void> {
  if (!messageIds.length || !getOnline()) return;
  const device_id = getDeviceId();
  const rows = messageIds.map((message_id) => ({
    message_id,
    device_id,
    user_id: userId,
  }));
  try {
    await supabase.from("dm_deliveries").upsert(rows, { onConflict: "message_id,device_id" });
    console.info("[dm-global] ack-delivery", { count: rows.length });
  } catch (error) {
    console.warn("[dm-global] ack-delivery-failed", { error });
  }
}

/**
 * Global hook: registers this device, drains any messages already on the
 * server for the user (offline messages), saves them locally, updates the chat
 * list cache, and acks them. It also reconnects/re-drains after network issues.
 */
export function useDmDeliveryWorker(): void {
  const { user } = useAuth();
  const online = useOnline();
  const [retryNonce, setRetryNonce] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!online) return;
    let mounted = true;
    const myId = user.id;

    const scheduleReconnect = (reason: string) => {
      if (!mounted || !getOnline()) return;
      if (reconnectTimerRef.current) return;
      console.warn("[dm-global] reconnect-scheduled", { reason });
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (mounted && getOnline()) setRetryNonce((n) => n + 1);
      }, 2500);
    };

    const drainPending = async () => {
      try {
        const { data } = await supabase
          .from("direct_messages")
          .select("id, sender_id, receiver_id, content, created_at, message_type, media_url, media_duration_ms, reply_to_id, delivered_at, read_at")
          .eq("receiver_id", myId)
          .order("created_at", { ascending: true })
          .limit(1000);
        if (!mounted || !data?.length) {
          console.info("[dm-global] drain-pending", { count: 0 });
          return;
        }
        console.info("[dm-global] drain-pending", { count: data.length });
        for (const m of data as DMRow[]) {
          await appendLocalDM(myId, m);
        }
        await ackDelivery(myId, (data as DMRow[]).map((m) => m.id));
      } catch (error) {
        console.warn("[dm-global] drain-pending-failed", { error });
      }
    };

    void registerDevice(myId);
    void drainPending();
    const beat = setInterval(() => { void registerDevice(myId); }, 6 * 60 * 60 * 1000);

    const ch = supabase
      .channel(`dm-delivery:${myId}:${retryNonce}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${myId}` },
        async (p) => {
          const m = p.new as DMRow;
          console.info("[dm-global] realtime-insert", { messageId: m.id, senderId: m.sender_id, type: m.message_type });
          await appendLocalDM(myId, m);
          await ackDelivery(myId, [m.id]);
        },
      )
      .subscribe((status) => {
        console.info("[dm-global] realtime-status", { status });
        if (status === "SUBSCRIBED") void drainPending();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          scheduleReconnect(status);
        }
      });

    const onOnline = () => {
      console.info("[dm-global] network-online");
      void registerDevice(myId);
      void drainPending();
      scheduleReconnect("online");
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void registerDevice(myId);
      void drainPending();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearInterval(beat);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [user, online, retryNonce]);
}