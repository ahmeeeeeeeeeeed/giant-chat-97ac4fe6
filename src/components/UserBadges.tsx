import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Badge = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  badge_type: string | null;
};

const cache = new Map<string, Badge[]>();
const pending = new Map<string, Promise<Badge[]>>();
const listeners = new Map<string, Set<(b: Badge[]) => void>>();

export async function getUserBadges(userId: string): Promise<Badge[]> {
  if (cache.has(userId)) return cache.get(userId)!;
  if (pending.has(userId)) return pending.get(userId)!;
  const p = (async () => {
    const { data } = await supabase
      .from("user_badges")
      .select("badge_id, awarded_at, badges:badge_id(id,name,icon,color,description,badge_type,is_active)")
      .eq("user_id", userId)
      .order("awarded_at", { ascending: false });
    const list: Badge[] = (data ?? [])
      .map((r: any) => r.badges)
      .filter((b: any) => b && b.is_active !== false);
    cache.set(userId, list);
    listeners.get(userId)?.forEach((cb) => cb(list));
    return list;
  })();
  pending.set(userId, p);
  try { return await p; } finally { pending.delete(userId); }
}

export function clearUserBadgesCache(userId?: string) {
  if (userId) cache.delete(userId); else cache.clear();
}

function useBadges(userId?: string | null) {
  const [badges, setBadges] = useState<Badge[]>(() => (userId && cache.get(userId)) || []);
  useEffect(() => {
    if (!userId) { setBadges([]); return; }
    let alive = true;
    const cached = cache.get(userId);
    if (cached) setBadges(cached);
    else getUserBadges(userId).then((b) => { if (alive) setBadges(b); }).catch(() => {});
    const set = listeners.get(userId) ?? new Set();
    const cb = (b: Badge[]) => { if (alive) setBadges(b); };
    set.add(cb);
    listeners.set(userId, set);
    return () => { alive = false; set.delete(cb); };
  }, [userId]);
  return badges;
}

function BadgeIcon({ b, size = 14 }: { b: Badge; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (b.icon && !broken) {
    return (
      <img
        src={b.icon}
        alt={b.name}
        title={b.name}
        onError={() => setBroken(true)}
        style={{ width: size, height: size }}
        className="inline-block object-contain align-middle"
      />
    );
  }
  return (
    <span
      title={b.name}
      style={{ width: size, height: size, backgroundColor: b.color || "#888" }}
      className="inline-block rounded-full align-middle ring-1 ring-white/30"
    />
  );
}

export function UserBadgesInline({ userId, size = 14, max = 4 }: { userId?: string | null; size?: number; max?: number }) {
  const badges = useBadges(userId);
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const extra = badges.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {shown.map((b) => <BadgeIcon key={b.id} b={b} size={size} />)}
      {extra > 0 && (
        <span className="text-[10px] font-bold text-muted-foreground">+{extra}</span>
      )}
    </span>
  );
}

export function UserBadgesGrid({ userId }: { userId: string }) {
  const badges = useBadges(userId);
  if (!badges.length) return null;
  return (
    <div className="mt-3 w-full max-w-md rounded-2xl border border-border/50 bg-card p-3">
      <div className="mb-2 text-[12px] font-bold text-muted-foreground">الشارات</div>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description || b.name}
            className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-2.5 py-1"
            style={b.color ? { borderColor: `${b.color}55`, boxShadow: `0 0 8px ${b.color}33` } : undefined}
          >
            <BadgeIcon b={b} size={16} />
            <span className="text-[11px] font-semibold">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
