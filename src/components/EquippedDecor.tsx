import { useEffect, useState } from "react";
import { getEquipped, type EquippedSet } from "@/lib/equipped";

export function useEquipped(userId?: string | null) {
  const [eq, setEq] = useState<EquippedSet>({});
  useEffect(() => {
    if (!userId) { setEq({}); return; }
    let alive = true;
    getEquipped(userId).then((s) => { if (alive) setEq(s); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  return eq;
}

export function EquippedFrame({
  userId,
  children,
  padding = 3,
  className = "",
}: {
  userId?: string | null;
  children: React.ReactNode;
  padding?: number;
  className?: string;
}) {
  const eq = useEquipped(userId);
  if (!eq.frame) return <>{children}</>;
  const grad = eq.frame.gradient || "from-primary to-fuchsia-500";
  const glow = eq.frame.glow || "shadow-primary/40";
  const animated = !!eq.frame.animated;
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-tr ${grad} shadow-lg ${glow} ${animated ? "animate-[spin_8s_linear_infinite]" : ""} ${className}`}
      style={{ padding }}
    >
      <div className={animated ? "[animation:spin_8s_linear_infinite_reverse] rounded-full" : "rounded-full"}>
        {children}
      </div>
    </div>
  );
}

export function EquippedBadgeChip({ userId }: { userId?: string | null }) {
  const eq = useEquipped(userId);
  if (!eq.badge) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm align-middle"
      style={{ backgroundColor: eq.badge.payload?.color ?? "#EF4444" }}
      title={eq.badge.name_ar}
    >
      {eq.badge.name_ar}
    </span>
  );
}

export function EquippedEffectFloat({ userId }: { userId?: string | null }) {
  const eq = useEquipped(userId);
  if (!eq.effect) return null;
  // Don't render entry_* effects here (those play once on entry)
  if (eq.effect.code.startsWith("entry_")) return null;
  const emoji = eq.effect.emoji || "✨";
  // floating emojis around the avatar
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="absolute text-lg animate-bounce"
          style={{
            top: `${10 + (i * 17) % 70}%`,
            left: `${(i * 37) % 90}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${1.6 + (i % 3) * 0.4}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
