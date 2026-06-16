import { useEffect, useState, useRef } from "react";

export type GiftBurst = {
  id: string;
  emoji: string;
  giftName: string;
  senderName?: string;
  receiverName?: string;
  effectType: "overlay" | "fullscreen" | "fly";
  isGlobal?: boolean;
};

export function GiftEffectOverlay({ burst }: { burst: GiftBurst | null }) {
  const [current, setCurrent] = useState<GiftBurst | null>(null);
  const queueRef = useRef<GiftBurst[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const playingRef = useRef(false);

  useEffect(() => {
    if (!burst || seenRef.current.has(burst.id)) return;
    seenRef.current.add(burst.id);
    queueRef.current.push(burst);
    drainQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst?.id]);

  function drainQueue() {
    if (playingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    playingRef.current = true;
    setCurrent(next);
    const dur = next.effectType === "fullscreen" ? 3500 : next.effectType === "fly" ? 2500 : 2200;
    setTimeout(() => {
      setCurrent(null);
      playingRef.current = false;
      setTimeout(drainQueue, 200);
    }, dur);
  }

  if (!current) return null;

  if (current.effectType === "fly") {
    // small flying emojis bottom-up
    return (
      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i}
            className="absolute text-4xl"
            style={{
              left: `${5 + Math.random() * 90}%`,
              bottom: "-10%",
              animation: `gift-fly-up ${1.8 + Math.random() * 0.8}s ease-out forwards`,
              animationDelay: `${Math.random() * 0.4}s`,
            }}>
            {current.emoji}
          </span>
        ))}
        <BurstLabel burst={current} />
        <style>{`@keyframes gift-fly-up {
          0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-120vh) scale(1.2) rotate(${Math.random() > 0.5 ? "" : "-"}30deg); opacity: 0; }
        }`}</style>
      </div>
    );
  }

  if (current.effectType === "overlay") {
    return (
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="text-[10rem] animate-gift-pop drop-shadow-2xl">{current.emoji}</div>
        <BurstLabel burst={current} />
        <style>{`@keyframes gift-pop {
          0% { transform: scale(0.2) rotate(-30deg); opacity: 0; }
          40% { transform: scale(1.3) rotate(8deg); opacity: 1; }
          70% { transform: scale(1) rotate(-3deg); }
          100% { transform: scale(0.9); opacity: 0; }
        } .animate-gift-pop { animation: gift-pop 2.1s ease-out forwards; }`}</style>
      </div>
    );
  }

  // fullscreen — confetti + giant gift
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden bg-gradient-to-br from-pink-500/30 via-fuchsia-500/30 to-amber-500/30 backdrop-blur-md">
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i}
          className="absolute text-2xl"
          style={{
            left: `${Math.random() * 100}%`,
            top: "-5%",
            animation: `gift-confetti ${2.5 + Math.random() * 1.5}s linear forwards`,
            animationDelay: `${Math.random() * 0.6}s`,
            color: `hsl(${Math.random() * 360},90%,60%)`,
          }}>
          {Math.random() > 0.5 ? current.emoji : "✨"}
        </span>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-[14rem] animate-gift-big drop-shadow-[0_0_40px_rgba(255,215,0,0.8)]">{current.emoji}</div>
      </div>
      <BurstLabel burst={current} big />
      <style>{`
        @keyframes gift-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.4; }
        }
        @keyframes gift-big {
          0% { transform: scale(0.1) rotate(-180deg); opacity: 0; }
          30% { transform: scale(1.4) rotate(10deg); opacity: 1; }
          70% { transform: scale(1.1) rotate(-5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 0; }
        }
        .animate-gift-big { animation: gift-big 3.4s ease-out forwards; }
      `}</style>
    </div>
  );
}

function BurstLabel({ burst, big }: { burst: GiftBurst; big?: boolean }) {
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 ${big ? "bottom-[18%]" : "bottom-[22%]"} text-center px-6`}>
      <div className={`inline-block rounded-2xl bg-black/60 backdrop-blur-md px-4 py-2 text-white shadow-2xl ${big ? "text-base" : "text-sm"}`}>
        {burst.isGlobal && <span className="me-1 text-amber-300">🌍</span>}
        <span className="font-bold">{burst.senderName ?? "مستخدم"}</span>
        <span className="opacity-80"> أهدى </span>
        <span className="font-bold">{burst.receiverName ?? "عضو"}</span>
        <span className="opacity-80"> {burst.giftName}</span>
      </div>
    </div>
  );
}
