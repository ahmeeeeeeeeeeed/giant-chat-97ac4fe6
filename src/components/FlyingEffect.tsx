import { useEffect, useState } from "react";

type Burst = { id: number; emoji: string; name?: string };

export function FlyingEffect({ burst }: { burst: Burst | null }) {
  const [items, setItems] = useState<Burst[]>([]);
  useEffect(() => {
    if (!burst) return;
    setItems((s) => [...s, burst]);
    const t = setTimeout(() => setItems((s) => s.filter((x) => x.id !== burst.id)), 4500);
    return () => clearTimeout(t);
  }, [burst]);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {items.map((it) => (
        <div key={it.id} className="absolute inset-0">
          {it.name && (
            <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full bg-primary/90 px-4 py-1.5 text-sm font-bold text-primary-foreground shadow-lg animate-fade-in">
              👋 دخل {it.name}
            </div>
          )}
          {Array.from({ length: 18 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 1.2;
            const dur = 3 + Math.random() * 1.5;
            const size = 24 + Math.random() * 28;
            const drift = (Math.random() - 0.5) * 120;
            return (
              <span
                key={i}
                style={{
                  left: `${left}%`,
                  bottom: "-40px",
                  fontSize: `${size}px`,
                  animation: `fly-up ${dur}s ${delay}s ease-out forwards`,
                  ["--drift" as never]: `${drift}px`,
                } as React.CSSProperties}
                className="absolute"
              >
                {it.emoji}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
