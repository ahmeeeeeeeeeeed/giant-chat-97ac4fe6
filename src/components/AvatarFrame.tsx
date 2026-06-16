import { useEffect, useState } from "react";
import { getEquipped, type EquippedSet } from "@/lib/equipped";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; ring: string; pad: string }> = {
  sm: { box: "h-8 w-8",  ring: "p-[2px]", pad: "" },
  md: { box: "h-10 w-10", ring: "p-[2px]", pad: "" },
  lg: { box: "h-14 w-14", ring: "p-[3px]", pad: "" },
  xl: { box: "h-24 w-24", ring: "p-[4px]", pad: "" },
};

/**
 * Wraps an avatar with the user's equipped avatar frame (if any).
 * If no frame is equipped, just renders children unchanged.
 */
export function AvatarFrame({
  userId,
  size = "md",
  children,
  frame: explicitFrame,
}: {
  userId?: string | null;
  size?: Size;
  children: React.ReactNode;
  frame?: EquippedSet["frame"];
}) {
  const [frame, setFrame] = useState<EquippedSet["frame"] | null>(explicitFrame ?? null);

  useEffect(() => {
    if (explicitFrame !== undefined) { setFrame(explicitFrame); return; }
    if (!userId) return;
    let alive = true;
    getEquipped(userId).then((e) => { if (alive) setFrame(e.frame ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [userId, explicitFrame]);

  if (!frame) return <>{children}</>;

  const s = SIZES[size];
  const glow = frame.glow ?? "shadow-primary/40";

  return (
    <span className={`relative inline-flex items-center justify-center rounded-full ${s.ring} bg-gradient-to-tr ${frame.gradient} shadow-lg ${glow} ${frame.animated ? "animate-[spin_8s_linear_infinite]" : ""}`}>
      <span className={`block rounded-full bg-background ${frame.animated ? "[animation:spin_8s_linear_infinite_reverse]" : ""}`}>
        {children}
      </span>
    </span>
  );
}
