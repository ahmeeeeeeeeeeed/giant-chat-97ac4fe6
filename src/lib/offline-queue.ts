// Outgoing message queue. Messages added while offline are persisted in
// IndexedDB and flushed automatically when the browser reports online again.
import { get, set, createStore } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { onConnectivityChange, getOnline } from "./use-online";

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";
const store = isBrowser ? createStore("giant-offline", "queue") : null;

const QUEUE_KEY = "outbox";

export type QueuedMessage =
  | {
      id: string;
      kind: "dm";
      sender_id: string;
      receiver_id: string;
      content: string;
      createdAt: number;
    }
  | {
      id: string;
      kind: "room";
      room_id: string;
      user_id: string;
      content: string;
      createdAt: number;
    };

async function readQueue(): Promise<QueuedMessage[]> {
  if (!store) return [];
  try {
    return (await get<QueuedMessage[]>(QUEUE_KEY, store)) ?? [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedMessage[]): Promise<void> {
  if (!store) return;
  try {
    await set(QUEUE_KEY, items, store);
  } catch {
    /* ignore */
  }
}

export type QueueInput =
  | { kind: "dm"; sender_id: string; receiver_id: string; content: string }
  | { kind: "room"; room_id: string; user_id: string; content: string };

export async function enqueueMessage(msg: QueueInput): Promise<QueuedMessage> {
  const base = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const full = { ...msg, ...base } as QueuedMessage;
  const q = await readQueue();
  q.push(full);
  await writeQueue(q);
  notify();
  return full;
}

export async function getQueue(): Promise<QueuedMessage[]> {
  return readQueue();
}

let flushing = false;

export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (!isBrowser || flushing || !getOnline()) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const queue = await readQueue();
    const remaining: QueuedMessage[] = [];
    for (const item of queue) {
      try {
        if (item.kind === "dm") {
          const { error } = await supabase.from("direct_messages").insert({
            sender_id: item.sender_id,
            receiver_id: item.receiver_id,
            content: item.content,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("room_messages").insert({
            room_id: item.room_id,
            user_id: item.user_id,
            content: item.content,
          });
          if (error) throw error;
        }
        sent++;
      } catch {
        failed++;
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
    notify();
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

const queueListeners = new Set<() => void>();
function notify() {
  queueListeners.forEach((l) => l());
}
export function onQueueChange(l: () => void): () => void {
  queueListeners.add(l);
  return () => queueListeners.delete(l);
}

if (isBrowser) {
  // Auto-flush when connectivity returns and on initial load.
  onConnectivityChange((online) => {
    if (online) void flushQueue();
  });
  if (getOnline()) {
    setTimeout(() => void flushQueue(), 2000);
  }
}
