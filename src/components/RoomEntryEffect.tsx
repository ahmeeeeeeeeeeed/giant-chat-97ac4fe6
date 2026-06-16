import { useEffect, useState, useRef } from "react";
import dragonImg from "@/assets/fx-dragon.png";
import princessImg from "@/assets/fx-princess.png";
import knightImg from "@/assets/fx-knight.png";
import magicImg from "@/assets/fx-magic.png";
import mascotImg from "@/assets/fx-mascot.png";
import portalImg from "@/assets/fx-portal.png";


export type EntryEffectType =
  | "dragon"
  | "princess"
  | "knight"
  | "magic"
  | "mascot"
  | "portal";

export const ENTRY_EFFECTS: { type: EntryEffectType; label: string; emoji: string }[] = [
  { type: "dragon", label: "تنين", emoji: "🐉" },
  { type: "princess", label: "أميرة", emoji: "👸" },
  { type: "knight", label: "فارس", emoji: "🐎" },
  { type: "magic", label: "انفجار سحري", emoji: "✨" },
  { type: "mascot", label: "ترحيب", emoji: "🤗" },
  { type: "portal", label: "بوابة سحرية", emoji: "🌀" },
];

export type EntryBurst = {
  id: number;
  type: EntryEffectType;
  name?: string;
};

const SETTINGS_KEY = "giant:roomEntryEffects";
export function getEntryEffectsEnabled(): boolean {
  try {
    const v = localStorage.getItem(SETTINGS_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}
export function setEntryEffectsEnabled(on: boolean): void {
  try { localStorage.setItem(SETTINGS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

export function pickRandomEffect(): EntryEffectType {
  const arr = ENTRY_EFFECTS;
  return arr[Math.floor(Math.random() * arr.length)].type;
}

/* ===================== Procedural Audio ===================== */

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ctx) _ctx = new Ctor();
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

function envGain(c: AudioContext, dest: AudioNode, t0: number, dur: number, peak = 0.25) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);
  return g;
}

function noiseBuffer(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playDragon(c: AudioContext) {
  const now = c.currentTime;
  // Roar: sawtooth sweep + lowpass
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 2.5);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(300, now);
  lp.frequency.linearRampToValueAtTime(700, now + 1.5);
  const g = envGain(c, c.destination, now, 3, 0.35);
  osc.connect(lp).connect(g);
  osc.start(now); osc.stop(now + 3);

  // Fire crackle: filtered noise burst at 1.2s
  const t1 = now + 1.0;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2.5);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const g2 = envGain(c, c.destination, t1, 2.5, 0.18);
  src.connect(hp).connect(g2);
  src.start(t1); src.stop(t1 + 2.5);
}

function playPrincess(c: AudioContext) {
  const now = c.currentTime;
  // Harp arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1046.5, 783.99, 659.25];
  notes.forEach((f, i) => {
    const t = now + i * 0.18;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = envGain(c, c.destination, t, 0.6, 0.18);
    o.connect(g);
    o.start(t); o.stop(t + 0.6);
  });
  // Twinkles
  for (let i = 0; i < 12; i++) {
    const t = now + 1.5 + Math.random() * 2.5;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = 2000 + Math.random() * 2000;
    const g = envGain(c, c.destination, t, 0.25, 0.08);
    o.connect(g);
    o.start(t); o.stop(t + 0.25);
  }
}

function playKnight(c: AudioContext) {
  const now = c.currentTime;
  // Continuous gallop hoofbeats over full ~5s (paired clip-clop)
  for (let i = 0; i < 22; i++) {
    const base = now + i * 0.22;
    [0, 0.07].forEach((off, k) => {
      const t = base + off;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.12);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = k === 0 ? 160 : 220;
      const g = envGain(c, c.destination, t, 0.12, k === 0 ? 0.5 : 0.35);
      src.connect(lp).connect(g);
      src.start(t); src.stop(t + 0.12);
    });
  }
  // Horse neigh at start: descending sawtooth with vibrato
  const t0 = now + 0.05;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(620, t0);
  o.frequency.exponentialRampToValueAtTime(380, t0 + 0.8);
  const lfo = c.createOscillator();
  lfo.frequency.value = 14;
  const lfoG = c.createGain();
  lfoG.gain.value = 30;
  lfo.connect(lfoG).connect(o.frequency);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 4;
  const g = envGain(c, c.destination, t0, 1.1, 0.28);
  o.connect(bp).connect(g);
  o.start(t0); o.stop(t0 + 1.1);
  lfo.start(t0); lfo.stop(t0 + 1.1);
  // Second neigh near the end (return trip)
  const t1 = now + 3.5;
  const o2 = c.createOscillator();
  o2.type = "sawtooth";
  o2.frequency.setValueAtTime(560, t1);
  o2.frequency.exponentialRampToValueAtTime(340, t1 + 0.7);
  const bp2 = c.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.frequency.value = 850;
  bp2.Q.value = 4;
  const g2 = envGain(c, c.destination, t1, 0.9, 0.24);
  o2.connect(bp2).connect(g2);
  o2.start(t1); o2.stop(t1 + 0.9);
}


function playMagic(c: AudioContext) {
  const now = c.currentTime;
  // Whoosh
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.0);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, now);
  bp.frequency.exponentialRampToValueAtTime(4000, now + 0.9);
  const g = envGain(c, c.destination, now, 1.0, 0.25);
  src.connect(bp).connect(g);
  src.start(now); src.stop(now + 1.0);
  // Bell chime
  [880, 1318, 1760].forEach((f, i) => {
    const t = now + 0.6 + i * 0.1;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const gg = envGain(c, c.destination, t, 1.8, 0.18);
    o.connect(gg);
    o.start(t); o.stop(t + 1.8);
  });
}

function playMascot(c: AudioContext) {
  const now = c.currentTime;
  // Cheerful chime up
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = now + i * 0.12;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = envGain(c, c.destination, t, 0.4, 0.2);
    o.connect(g);
    o.start(t); o.stop(t + 0.4);
  });
  // Clap: noise bursts
  for (let i = 0; i < 4; i++) {
    const t = now + 1 + i * 0.25;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.08);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    const g = envGain(c, c.destination, t, 0.08, 0.3);
    src.connect(hp).connect(g);
    src.start(t); src.stop(t + 0.08);
  }
}

function playPortal(c: AudioContext) {
  const now = c.currentTime;
  // Swirling whoosh
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2.5);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 8;
  bp.frequency.setValueAtTime(300, now);
  bp.frequency.exponentialRampToValueAtTime(2500, now + 2.0);
  const g = envGain(c, c.destination, now, 2.5, 0.3);
  src.connect(bp).connect(g);
  src.start(now); src.stop(now + 2.5);
  // Drone
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(110, now);
  o.frequency.linearRampToValueAtTime(220, now + 2);
  const og = envGain(c, c.destination, now, 2.5, 0.15);
  o.connect(og);
  o.start(now); o.stop(now + 2.5);
}

function playSound(type: EntryEffectType) {
  const c = ctx();
  if (!c) return;
  try {
    if (type === "dragon") playDragon(c);
    else if (type === "princess") playPrincess(c);
    else if (type === "knight") playKnight(c);
    else if (type === "magic") playMagic(c);
    else if (type === "mascot") playMascot(c);
    else if (type === "portal") playPortal(c);
  } catch { /* ignore */ }
}

/* ===================== Visuals ===================== */

function NameBanner({ name, color }: { name?: string; color: string }) {
  if (!name) return null;
  return (
    <div
      className="absolute left-1/2 top-10 -translate-x-1/2 rounded-full px-5 py-2 text-base font-extrabold text-white shadow-2xl animate-fade-in z-10"
      style={{ background: color, boxShadow: `0 8px 30px ${color}` }}
    >
      👋 دخل {name}
    </div>
  );
}

function Sparkles({ count = 24, color = "#fff" }: { count?: number; color?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 2.5;
        const size = 8 + Math.random() * 18;
        return (
          <span
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              fontSize: size,
              color,
              animation: `sparkle 1.6s ${delay}s ease-out infinite`,
              textShadow: `0 0 10px ${color}`,
            }}
          >
            ✦
          </span>
        );
      })}
    </>
  );
}

function CharImg({ src, alt, style, className }: { src: string; alt: string; style?: React.CSSProperties; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`block ${className || ""}`}
      style={{ width: "100%", height: "auto", objectFit: "contain", ...style }}
    />
  );
}

function DragonEffect() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 animate-fade-in" style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,90,0,0.45), transparent 65%)" }} />
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "dragon-fly 5s ease-in-out forwards",
          filter: "drop-shadow(0 0 40px rgba(255,80,0,0.85))",
        }}
      >
        <CharImg src={dragonImg} alt="Dragon" />
      </div>
      {/* Fire embers */}
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${30 + Math.random() * 40}%`,
            fontSize: 28 + Math.random() * 30,
            animation: `fire-puff 2s ${0.8 + Math.random() * 1.8}s ease-out forwards`,
            opacity: 0,
            filter: "drop-shadow(0 0 8px rgba(255,140,0,0.9))",
          }}
        >
          🔥
        </span>
      ))}
    </div>
  );
}

function PrincessEffect() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 animate-fade-in" style={{ background: "radial-gradient(circle at 50% 60%, rgba(255,150,220,0.35), transparent 65%)" }} />
      <Sparkles count={36} color="#ffd6f5" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "princess-dance 5s ease-in-out forwards",
          filter: "drop-shadow(0 0 50px rgba(255,180,230,0.95))",
          transformOrigin: "center",
        }}
      >
        <CharImg src={princessImg} alt="Princess" />
      </div>
    </div>
  );
}

function KnightEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 animate-fade-in" style={{ background: "linear-gradient(90deg, rgba(146,64,14,0.35), transparent 60%)" }} />
      {Array.from({ length: 25 }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-[15%]"
          style={{
            left: `${Math.random() * 100}%`,
            fontSize: 26 + Math.random() * 30,
            animation: `dust-rise 2.5s ${Math.random() * 2}s ease-out forwards`,
            opacity: 0,
          }}
        >
          💨
        </span>
      ))}
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "knight-gallop 5s linear forwards",
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.55))",
        }}
      >
        <CharImg src={knightImg} alt="Knight" />
      </div>
    </div>
  );
}

function MagicEffect() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 animate-fade-in"
           style={{ background: "radial-gradient(circle at center, rgba(180,120,255,0.45), transparent 60%)" }} />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "magic-burst 5s ease-out forwards",
          filter: "drop-shadow(0 0 50px gold)",
        }}
      >
        <CharImg src={magicImg} alt="Magic burst" />
      </div>
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * 2 * Math.PI;
        const dist = 220 + Math.random() * 200;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              fontSize: 18 + Math.random() * 26,
              ["--mx" as never]: `${dx}px`,
              ["--my" as never]: `${dy}px`,
              animation: `magic-particle 2.5s ${Math.random() * 0.8}s ease-out forwards`,
              opacity: 0,
            } as React.CSSProperties}
          >
            {["⭐", "✨", "💫", "🌟"][i % 4]}
          </span>
        );
      })}
    </div>
  );
}

function MascotEffect() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 animate-fade-in" style={{ background: "radial-gradient(circle at 50% 60%, rgba(255,200,80,0.4), transparent 65%)" }} />
      <Sparkles count={20} color="#fff7a8" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "mascot-bounce 5s ease-in-out forwards",
          filter: "drop-shadow(0 0 35px rgba(255,200,0,0.8))",
        }}
      >
        <CharImg src={mascotImg} alt="Mascot" />
      </div>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            fontSize: 28 + Math.random() * 22,
            animation: `confetti-fall 4s ${Math.random() * 1.5}s linear forwards`,
            opacity: 0,
          }}
        >
          🎉
        </span>
      ))}
    </div>
  );
}

function PortalEffect() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 animate-fade-in"
           style={{ background: "radial-gradient(circle at center, rgba(0,200,255,0.5), rgba(80,40,200,0.25) 40%, transparent 70%)" }} />
      {/* Spinning portal ring (CSS) */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "min(80vw, 520px)",
          height: "min(80vw, 520px)",
          background: "conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)",
          filter: "blur(18px) drop-shadow(0 0 60px cyan)",
          animation: "portal-ring 5s linear forwards",
          opacity: 0.85,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/60"
        style={{ width: "min(55vw, 360px)", height: "min(55vw, 360px)", animation: "portal-ring 5s linear forwards" }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(90vw, 560px)",
          height: "auto",
          animation: "portal-emerge 5s ease-out forwards",
          filter: "drop-shadow(0 0 30px rgba(120,200,255,0.9))",
        }}
      >
        <CharImg src={portalImg} alt="Wizard portal" />
      </div>
      <Sparkles count={22} color="#a0f0ff" />
    </div>
  );
}

const EFFECT_COLOR: Record<EntryEffectType, string> = {
  dragon: "linear-gradient(135deg,#7a1f1f,#ff5500)",
  princess: "linear-gradient(135deg,#d946ef,#ec4899)",
  knight: "linear-gradient(135deg,#92400e,#f59e0b)",
  magic: "linear-gradient(135deg,#7c3aed,#3b82f6)",
  mascot: "linear-gradient(135deg,#f59e0b,#facc15)",
  portal: "linear-gradient(135deg,#0891b2,#6366f1)",
};

/* ===================== Main Component ===================== */

export function RoomEntryEffect({ burst }: { burst: EntryBurst | null }) {
  const [items, setItems] = useState<EntryBurst[]>([]);
  const lastIdRef = useRef<number>(0);

  useEffect(() => {
    if (!burst || burst.id === lastIdRef.current) return;
    lastIdRef.current = burst.id;
    if (!getEntryEffectsEnabled()) return;

    setItems((s) => [...s, burst]);
    playSound(burst.type);
    const t = setTimeout(() => {
      setItems((s) => s.filter((x) => x.id !== burst.id));
    }, 5000);
    return () => clearTimeout(t);
  }, [burst]);

  if (!items.length) return null;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
        {items.map((it) => (
          <div key={it.id} className="absolute inset-0 animate-fade-in" style={{ animation: "fx-fade 5s ease-out forwards" }}>
            <NameBanner name={it.name} color={EFFECT_COLOR[it.type]} />
            {it.type === "dragon" && <DragonEffect />}
            {it.type === "princess" && <PrincessEffect />}
            {it.type === "knight" && <KnightEffect />}
            {it.type === "magic" && <MagicEffect />}
            {it.type === "mascot" && <MascotEffect />}
            {it.type === "portal" && <PortalEffect />}
          </div>
        ))}
      </div>
    </>
  );
}

const KEYFRAMES = `
@keyframes fx-fade { 0%{opacity:0} 8%{opacity:1} 85%{opacity:1} 100%{opacity:0} }
@keyframes sparkle { 0%{transform:scale(0) rotate(0);opacity:0} 30%{opacity:1} 100%{transform:scale(1.6) rotate(180deg);opacity:0} }
@keyframes dragon-fly {
  0%   { top: 110vh; transform: translateX(-50%) scale(0.7); opacity: 0; }
  15%  { top: 50%;   transform: translate(-50%,-50%) scale(1); opacity: 1; }
  70%  { top: 50%;   transform: translate(-50%,-50%) scale(1.05); opacity: 1; }
  100% { top: -60vh; transform: translateX(-50%) scale(0.6); opacity: 0; }
}
@keyframes fire-puff {
  0% { transform: scale(0.4) translateY(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: scale(2.2) translateY(40px); opacity: 0; }
}
@keyframes princess-dance {
  0%   { transform: translate(-50%, 120vh) scale(0.6); opacity: 0; }
  15%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  35%  { transform: translate(-50%, -52%) scale(1.02) rotate(-3deg); }
  55%  { transform: translate(-50%, -48%) scale(1) rotate(3deg); }
  75%  { transform: translate(-50%, -50%) scale(1.03); opacity: 1; }
  100% { transform: translate(-50%, -150vh) scale(0.7); opacity: 0; }
}
@keyframes knight-gallop {
  0%   { left: -50vw;  transform: translateY(-50%) scaleX(1); }
  35%  { left: 110vw;  transform: translateY(-50%) scaleX(1); }
  36%  { left: 110vw;  transform: translateY(-50%) scaleX(-1); }
  85%  { left: -40vw;  transform: translateY(-50%) scaleX(-1); }
  100% { left: -60vw;  transform: translateY(-50%) scaleX(-1); opacity: 0; }
}
@keyframes dust-rise {
  0% { transform: translateY(0) scale(0.5); opacity: 0; }
  30% { opacity: 0.9; }
  100% { transform: translateY(-120px) scale(2); opacity: 0; }
}
@keyframes magic-burst {
  0% { transform: translate(-50%,-50%) scale(0) rotate(0); opacity: 0; }
  20% { transform: translate(-50%,-50%) scale(1.4) rotate(180deg); opacity: 1; }
  60% { transform: translate(-50%,-50%) scale(1) rotate(540deg); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(0.4) rotate(720deg); opacity: 0; }
}
@keyframes magic-particle {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--mx, 0px)), calc(-50% + var(--my, 0px))) scale(1.2); opacity: 0; }
}
@keyframes mascot-bounce {
  0% { transform: translate(-50%, 120vh) scale(0.5); }
  20% { transform: translate(-50%, -50%) scale(1.2); }
  30% { transform: translate(-50%, -45%) scale(1); }
  40% { transform: translate(-50%, -55%) scale(1.1); }
  50% { transform: translate(-50%, -50%) scale(1); }
  70% { transform: translate(-50%, -52%) scale(1.05); }
  85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -120vh) scale(0.7); opacity: 0; }
}
@keyframes confetti-fall {
  0% { transform: translateY(-100px) rotate(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(80vh) rotate(720deg); opacity: 0; }
}
@keyframes portal-spin {
  0% { transform: translate(-50%,-50%) scale(0) rotate(0); opacity: 0; }
  20% { transform: translate(-50%,-50%) scale(1) rotate(360deg); opacity: 1; }
  80% { transform: translate(-50%,-50%) scale(1.1) rotate(1440deg); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(0) rotate(1800deg); opacity: 0; }
}
@keyframes portal-emerge {
  0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
  40% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
  60% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; }
  80% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%,-200%) scale(1.4); opacity: 0; }
}
@keyframes portal-ring {
  0% { transform: translate(-50%,-50%) scale(0) rotate(0); opacity: 0; }
  20% { transform: translate(-50%,-50%) scale(1) rotate(360deg); opacity: 1; }
  85% { transform: translate(-50%,-50%) scale(1.05) rotate(1440deg); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(0) rotate(1800deg); opacity: 0; }
}
`;
