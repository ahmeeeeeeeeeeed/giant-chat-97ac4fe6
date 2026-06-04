import { supabase } from "@/integrations/supabase/client";

export type EquippedSet = {
  badge?: { code: string; name_ar: string; payload: { color?: string; icon?: string } } | null;
  name_color?: { color: string } | null;
  chat_color?: { color: string } | null;
  effect?: { code: string; emoji: string } | null;
};

const cache = new Map<string, EquippedSet>();
const pending = new Map<string, Promise<EquippedSet>>();

export async function getEquipped(userId: string): Promise<EquippedSet> {
  if (cache.has(userId)) return cache.get(userId)!;
  if (pending.has(userId)) return pending.get(userId)!;
  const p = (async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("equipped_badge, equipped_name_color, equipped_chat_color, equipped_effect")
      .eq("id", userId).maybeSingle();
    const ids = [p?.equipped_badge, p?.equipped_name_color, p?.equipped_chat_color, p?.equipped_effect].filter(Boolean) as string[];
    const set: EquippedSet = {};
    if (ids.length) {
      const { data: items } = await supabase.from("shop_items").select("id,kind,code,name_ar,payload").in("id", ids);
      for (const it of items ?? []) {
        const payload = (it.payload ?? {}) as Record<string, string>;
        if (it.kind === "badge") set.badge = { code: it.code, name_ar: it.name_ar, payload };
        else if (it.kind === "name_color") set.name_color = { color: payload.color ?? "#fff" };
        else if (it.kind === "chat_color") set.chat_color = { color: payload.color ?? "#fff" };
        else if (it.kind === "effect") set.effect = { code: it.code, emoji: payload.emoji ?? "✨" };
      }
    }
    cache.set(userId, set);
    return set;
  })();
  pending.set(userId, p);
  try { return await p; } finally { pending.delete(userId); }
}

export function clearEquippedCache(userId?: string) {
  if (userId) cache.delete(userId); else cache.clear();
}
