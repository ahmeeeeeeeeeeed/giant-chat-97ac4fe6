// Ephemeral DM delivery: on receiving a message we save it locally then
// insert into dm_deliveries. A DB trigger deletes the message row from
// the server once every active recipient device has acknowledged.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOnline, getOnline } from "@/lib/use-online";
import { getDeviceId } from "@/lib/dm-device";
import { cacheGet, cacheSet, cacheKeys } from "@/lib/offline-cache";
import { events } from "@/lib/events";

export type DMRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  message_type: "text" | "image" | "voice";
  media_url: string | null;
  media_duration_ms: number | null;
  reply_to_id: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
};

type Convo = { 
  otherId: string; 
  username: string; 
  avatar_url: string | null; 
  last: string; 
  created_at: string; 
  unread: number 
};

/** Register this device for the current user and refresh last_seen. */
export async function registerDevice(userId: string): Promise<void> {
  if (!getOnline()) return;
  const device_id = getDeviceId();
  try {
    await supabase.from("dm_devices").upsert(
      { user_id: userId, device_id, last_seen: new Date().toISOString() },
      { onConflict: "user_id,device_id" },
    );
  } catch {
    /* ignore */
  }
}

/** Append a message to the local conversation cache (idempotent by id). */
export async function appendLocalDM(myUserId: string, msg: DMRow): Promise<void> {
  const peerId = msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;
  const key = cacheKeys.dmMessages(myUserId, peerId);
  const list = (await cacheGet<DMRow[]>(key)) ?? [];
  if (list.some((x) => x.id === msg.id)) return;
  list.push(msg);
  // Cap at 2000 most-recent per conversation to bound storage.
  const trimmed = list.length > 2000 ? list.slice(list.length - 2000) : list;
  await cacheSet(key, trimmed);
}

/** Update the global chat list cache with the latest message. */
export async function updateChatsListCache(myUserId: string, msg: DMRow): Promise<void> {
  const otherId = msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;
  const key = cacheKeys.chatsList(myUserId);
  const convos = (await cacheGet<Convo[]>(key)) ?? [];
  
  let existingIdx = convos.findIndex(c => c.otherId === otherId);
  const isIncoming = msg.receiver_id === myUserId && !msg.read_at;
  const preview = msg.message_type === "image" ? "🖼️ صورة" : msg.message_type === "voice" ? "🎙️ رسالة صوتية" : msg.content;

  if (existingIdx !== -1) {
    const existing = convos[existingIdx];
    const updated: Convo = {
      ...existing,
      last: preview,
      created_at: msg.created_at,
      unread: isIncoming ? existing.unread + 1 : existing.unread
    };
    convos.splice(existingIdx, 1);
    convos.unshift(updated);
  } else {
    // New conversation - fetch profile
    try {
      const { data: p } = await supabase.from("profiles").select("username, avatar_url").eq("id", otherId).maybeSingle();
      const newConvo: Convo = {
        otherId,
        username: p?.username ?? "مستخدم",
        avatar_url: p?.avatar_url ?? null,
        last: preview,
        created_at: msg.created_at,
        unread: isIncoming ? 1 : 0
      };
      convos.unshift(newConvo);
    } catch {
      // ignore if fetch fails, will be caught by full refresh later
      return;
    }
  }
  await cacheSet(key, convos);
}

/** Mark a previously-saved message as delivered in the local cache. */
export async function markLocalDelivered(myUserId: string, peerId: string, messageId: string): Promise<void> {
  const key = cacheKeys.dmMessages(myUserId, peerId);
  const list = (await cacheGet<DMRow[]>(key)) ?? [];
  const next = list.map((m) =>
    m.id === messageId && !m.delivered_at
      ? { ...m, delivered_at: new Date().toISOString() }
      : m,
  );
  await cacheSet(key, next);
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
  } catch {
    /* swallow; will retry on next sync */
  }
}

/**
 * Global hook: registers this device, drains any messages already on the
 * server for the user (offline messages), saves them locally, and acks them.
 * Also listens in realtime for new messages so they are cached & acked even
 * when the relevant chat page is not open.
 */
export function useDmDeliveryWorker(): void {
  const { user } = useAuth();
  const online = useOnline();

  useEffect(() => {
    if (!user) return;
    if (!online) return;
    let mounted = true;
    const myId = user.id;

    const drainPending = async () => {
      console.info("[dm-delivery] draining pending messages...");
      try {
        const { data } = await supabase
          .from("direct_messages")
          .select("id, sender_id, receiver_id, content, created_at, message_type, media_url, media_duration_ms, reply_to_id, delivered_at, read_at")
          .eq("receiver_id", myId)
          .order("created_at", { ascending: true })
          .limit(1000);
        
        if (!mounted || !data?.length) return;
        
        console.info(`[dm-delivery] found ${data.length} pending messages`);
        for (const m of data as DMRow[]) {
          await appendLocalDM(myId, m);
          await updateChatsListCache(myId, m);
          events.emit("dm_received", m);
        }
        await ackDelivery(myId, (data as DMRow[]).map((m) => m.id));
      } catch (err) {
        console.error("[dm-delivery] drain failed", err);
      }
    };

    void registerDevice(myId);
    void drainPending();
    const beat = setInterval(() => { void registerDevice(myId); }, 6 * 60 * 60 * 1000);

    const ch = supabase
      .channel(`dm-delivery:${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${myId}` },
        async (p) => {
          const m = p.new as DMRow;
          console.info("[dm-delivery] realtime message received", m.id);
          await appendLocalDM(myId, m);
          await updateChatsListCache(myId, m);
          await ackDelivery(myId, [m.id]);
          events.emit("dm_received", m);
        },
      )
      .subscribe((status) => {
        console.info(`[dm-delivery] realtime status: ${status}`);
        if (status === "SUBSCRIBED") {
          void drainPending(); // check again on reconnect
        }
      });

    return () => {
      mounted = false;
      clearInterval(beat);
      supabase.removeChannel(ch);
    };
  }, [user, online]);
}
