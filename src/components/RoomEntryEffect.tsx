import { useEffect, useState, useRef } from "react";
import dragonVid from "@/assets/fx-dragon.mp4.asset.json";
import princessVid from "@/assets/fx-princess.mp4.asset.json";
import knightVid from "@/assets/fx-knight.mp4.asset.json";
import magicVid from "@/assets/fx-magic.mp4.asset.json";
import mascotVid from "@/assets/fx-mascot.mp4.asset.json";
import portalVid from "@/assets/fx-portal.mp4.asset.json";

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
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.0);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, now);
  bp.frequency.exponentialRampToValueAtTime(4000, now + 0.9);
  const g = envGain(c, c.destination, now, 1.0, 0.25);
  src.connect(bp).connect(g);
  src.start(now); src.stop(now + 1.0);
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
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const t = now + i * 0.12;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = envGain(c, c.destination, t, 0.4, 0.2);
    o.connect(g);
    o.start(t); o.stop(t + 0.4);
  });
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

const VIDEO_SRC: Record<EntryEffectType, string> = {
  dragon: dragonVid.url,
  princess: princessVid.url,
  knight: knightVid.url,
  magic: magicVid.url,
  mascot: mascotVid.url,
  portal: portalVid.url,
};

const EFFECT_COLOR: Record<EntryEffectType, string> = {
  dragon: "linear-gradient(135deg,#7a1f1f,#ff5500)",
  princess: "linear-gradient(135deg,#d946ef,#ec4899)",
  knight: "linear-gradient(135deg,#92400e,#f59e0b)",
  magic: "linear-gradient(135deg,#7c3aed,#3b82f6)",
  mascot: "linear-gradient(135deg,#f59e0b,#facc15)",
  portal: "linear-gradient(135deg,#0891b2,#6366f1)",
};

function NameBanner({ name, color }: { name?: string; color: string }) {
  if (!name) return null;
  return (
    <div
      className="absolute left-1/2 top-10 -translate-x-1/2 rounded-full px-5 py-2 text-base font-extrabold text-white shadow-2xl animate-fade-in"
      style={{ background: color, boxShadow: `0 8px 30px ${color}` }}
    >
      👋 دخل {name}
    </div>
  );
}

// Per-effect cinematic motion: each has its own entry path, in-scene motion, and exit.
// Wrapper handles the camera (shake + zoom). Inner video handles the character travel.
const MOTION: Record<EntryEffectType, { wrapper: string; inner: string }> = {
  dragon: { wrapper: "fx-cam-strong", inner: "fx-dragon-fly" },
  princess: { wrapper: "fx-cam-soft", inner: "fx-princess-float" },
  knight: { wrapper: "fx-cam-gallop", inner: "fx-knight-run" },
  magic: { wrapper: "fx-cam-pulse", inner: "fx-magic-burst" },
  mascot: { wrapper: "fx-cam-soft", inner: "fx-mascot-bounce" },
  portal: { wrapper: "fx-cam-pulse", inner: "fx-portal-warp" },
};

/* Fully transparent CSS/SVG visuals — no video, no background */
function SvgVisual({ type }: { type: EntryEffectType }) {
  const common = { width: "100%", height: "100%", viewBox: "0 0 200 200", style: { overflow: "visible" as const } };

  if (type === "dragon") {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="dg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffaa33" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#ff5500" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#7a1f1f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="100" rx="70" ry="28" fill="url(#dg)" />
        <path d="M30 100 Q60 70 100 95 Q140 70 170 100 Q140 130 100 105 Q60 130 30 100 Z"
          fill="none" stroke="#ffcc66" strokeWidth="2" opacity="0.8" />
        <circle cx="100" cy="100" r="6" fill="#fff8aa" opacity="0.9" />
      </svg>
    );
  }
  if (type === "princess") {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="pg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f0abfc" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#d946ef" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="60" fill="url(#pg)" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x = 100 + Math.cos(a) * 70;
          const y = 100 + Math.sin(a) * 70;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#fff" opacity="0.9" />;
        })}
        <path d="M100 60 L106 92 L138 100 L106 108 L100 140 L94 108 L62 100 L94 92 Z"
          fill="#fff" opacity="0.85" />
      </svg>
    );
  }
  if (type === "knight") {
    return (
      <svg {...common}>
        <defs>
          <linearGradient id="kg" x1="0" x2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#92400e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="10" y="90" width="180" height="20" fill="url(#kg)" />
        <path d="M70 110 Q80 80 100 90 Q120 70 135 95 Q145 115 130 120 L70 120 Z"
          fill="#92400e" opacity="0.85" stroke="#fde68a" strokeWidth="1.5" />
        <circle cx="128" cy="92" r="6" fill="#fde68a" opacity="0.9" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={60 - i * 18} y1="115" x2={50 - i * 18} y2="115"
            stroke="#fde68a" strokeWidth="2" opacity={0.7 - i * 0.15} />
        ))}
      </svg>
    );
  }
  if (type === "magic") {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="mg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="40%" stopColor="#a78bfa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="80" fill="url(#mg)" />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const x1 = 100 + Math.cos(a) * 20;
          const y1 = 100 + Math.sin(a) * 20;
          const x2 = 100 + Math.cos(a) * 90;
          const y2 = 100 + Math.sin(a) * 90;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#fff" strokeWidth="1.5" opacity="0.7" />;
        })}
        {Array.from({ length: 20 }).map((_, i) => {
          const a = Math.random() * Math.PI * 2;
          const r = 30 + Math.random() * 60;
          return <circle key={i} cx={100 + Math.cos(a) * r} cy={100 + Math.sin(a) * r}
            r="1.8" fill="#fff" opacity="0.9" />;
        })}
      </svg>
    );
  }
  if (type === "mascot") {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="mcg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="55" fill="url(#mcg)" />
        <circle cx="85" cy="92" r="5" fill="#000" opacity="0.7" />
        <circle cx="115" cy="92" r="5" fill="#000" opacity="0.7" />
        <path d="M80 112 Q100 130 120 112" stroke="#000" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        {[60, 140].map((x, i) => (
          <path key={i} d={`M${x} 100 Q${x + (i ? 20 : -20)} 80 ${x + (i ? 30 : -30)} 95`}
            stroke="#f59e0b" strokeWidth="3" fill="none" opacity="0.8" strokeLinecap="round" />
        ))}
      </svg>
    );
  }
  // portal
  return (
    <svg {...common}>
      <defs>
        <radialGradient id="ptg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="40%" stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#6366f1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="80" fill="url(#ptg)" />
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx="100" cy="100" rx={70 - i * 12} ry={28 - i * 4}
          fill="none" stroke="#22d3ee" strokeWidth="1.5" opacity={0.7 - i * 0.15}
          transform={`rotate(${i * 30} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="8" fill="#fff" opacity="0.9" />
    </svg>
  );
}

function VideoEffect({ type }: { type: EntryEffectType }) {
  const m = MOTION[type];
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        animation: `${m.inner} 5s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        willChange: "transform, opacity, filter",
      }}
    >
      <div style={{ width: "min(60vw, 420px)", height: "min(60vw, 420px)" }}>
        <SvgVisual type={type} />
      </div>
    </div>
  );
}


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
      <div
        className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
        style={{ perspective: "1200px" }}
      >
        {items.map((it) => {
          const m = MOTION[it.type];
          return (
            <div
              key={it.id}
              className="absolute inset-0"
              style={{
                animation: `fx-fade 5s ease-out forwards, ${m.wrapper} 5s ease-in-out forwards`,
                transformStyle: "preserve-3d",
                willChange: "transform, opacity",
              }}
            >
              <NameBanner name={it.name} color={EFFECT_COLOR[it.type]} />
              <VideoEffect type={it.type} />
            </div>
          );
        })}
      </div>
    </>
  );
}

const KEYFRAMES = `
@keyframes fx-fade { 0%{opacity:0} 6%{opacity:1} 88%{opacity:1} 100%{opacity:0} }

/* ===== Camera (wrapper) — handheld / cinematic shake & zoom ===== */
@keyframes fx-cam-soft {
  0%   { transform: translate3d(0,0,0) scale(1.02); }
  20%  { transform: translate3d(-0.6%, 0.4%, 0) scale(1.03); }
  45%  { transform: translate3d(0.5%, -0.5%, 0) scale(1.04); }
  70%  { transform: translate3d(-0.3%, 0.6%, 0) scale(1.03); }
  100% { transform: translate3d(0,0,0) scale(1.0); }
}
@keyframes fx-cam-strong {
  0%   { transform: translate3d(0,0,0) scale(1.0) rotate(0deg); }
  10%  { transform: translate3d(1.2%, -0.8%, 0) scale(1.05) rotate(0.4deg); }
  25%  { transform: translate3d(-1.4%, 0.9%, 0) scale(1.06) rotate(-0.5deg); }
  45%  { transform: translate3d(1.0%, 0.7%, 0) scale(1.07) rotate(0.3deg); }
  65%  { transform: translate3d(-0.8%, -0.6%, 0) scale(1.05) rotate(-0.3deg); }
  85%  { transform: translate3d(0.4%, 0.3%, 0) scale(1.03) rotate(0.1deg); }
  100% { transform: translate3d(0,0,0) scale(1.0) rotate(0deg); }
}
@keyframes fx-cam-gallop {
  0%   { transform: translate3d(0, 0, 0) scale(1.0); }
  8%   { transform: translate3d(0, -0.7%, 0) scale(1.015); }
  16%  { transform: translate3d(0, 0.6%, 0) scale(1.02); }
  24%  { transform: translate3d(0, -0.6%, 0) scale(1.015); }
  32%  { transform: translate3d(0, 0.5%, 0) scale(1.02); }
  40%  { transform: translate3d(0, -0.5%, 0) scale(1.015); }
  48%  { transform: translate3d(0, 0.4%, 0) scale(1.01); }
  100% { transform: translate3d(0,0,0) scale(1.0); }
}
@keyframes fx-cam-pulse {
  0%   { transform: scale(1.0); filter: blur(0px); }
  15%  { transform: scale(1.08); filter: blur(0.4px); }
  40%  { transform: scale(1.04); filter: blur(0px); }
  70%  { transform: scale(1.06); filter: blur(0.2px); }
  100% { transform: scale(1.0); filter: blur(0px); }
}

/* ===== Character (inner) — choreographed per-effect motion ===== */

/* Dragon: swoops in from top-right depth, arcs across, exits up */
@keyframes fx-dragon-fly {
  0%   { transform: translate3d(60vw, -50vh, -400px) scale(0.4) rotate(15deg); opacity: 0; }
  15%  { transform: translate3d(20vw, -10vh, -100px) scale(0.85) rotate(8deg); opacity: 1; }
  40%  { transform: translate3d(-15vw, 5vh, 0) scale(1.05) rotate(-4deg); opacity: 1; }
  65%  { transform: translate3d(10vw, -8vh, 0) scale(1.0) rotate(3deg); opacity: 1; }
  85%  { transform: translate3d(0, -20vh, 0) scale(0.9) rotate(-2deg); opacity: 0.9; }
  100% { transform: translate3d(-10vw, -80vh, 200px) scale(0.5) rotate(-10deg); opacity: 0; }
}

/* Princess: floats up from below, hovers, drifts away */
@keyframes fx-princess-float {
  0%   { transform: translate3d(0, 80vh, -200px) scale(0.7); opacity: 0; }
  18%  { transform: translate3d(-3vw, 10vh, 0) scale(1.0); opacity: 1; }
  40%  { transform: translate3d(3vw, 0, 0) scale(1.02); opacity: 1; }
  60%  { transform: translate3d(-2vw, -3vh, 0) scale(1.03); opacity: 1; }
  80%  { transform: translate3d(2vw, -8vh, 0) scale(1.01); opacity: 1; }
  100% { transform: translate3d(0, -60vh, 300px) scale(0.6); opacity: 0; }
}

/* Knight: gallops left→right→left across the screen */
@keyframes fx-knight-run {
  0%   { transform: translate3d(-110vw, 0, 0) scale(0.9); opacity: 0; }
  10%  { transform: translate3d(-60vw, 0, 0) scale(0.95); opacity: 1; }
  35%  { transform: translate3d(0, 0, 0) scale(1.0); opacity: 1; }
  50%  { transform: translate3d(40vw, 0, 0) scale(1.0); opacity: 1; }
  60%  { transform: translate3d(60vw, 0, 0) scale(1.0) scaleX(-1); opacity: 1; }
  85%  { transform: translate3d(-20vw, 0, 0) scale(0.95) scaleX(-1); opacity: 1; }
  100% { transform: translate3d(-110vw, 0, 0) scale(0.9) scaleX(-1); opacity: 0; }
}

/* Magic: explodes from depth at center, expands, drifts, fades */
@keyframes fx-magic-burst {
  0%   { transform: scale(0.2) translateZ(-500px) rotate(0deg); opacity: 0; filter: brightness(2); }
  15%  { transform: scale(1.15) translateZ(0) rotate(30deg); opacity: 1; filter: brightness(1.4); }
  40%  { transform: scale(1.0) translateZ(0) rotate(60deg); opacity: 1; filter: brightness(1.1); }
  70%  { transform: scale(1.08) translateZ(50px) rotate(90deg); opacity: 1; filter: brightness(1); }
  100% { transform: scale(1.6) translateZ(300px) rotate(120deg); opacity: 0; filter: brightness(1.3); }
}

/* Mascot: bouncy entry from bottom-left, waves around, exits bottom-right */
@keyframes fx-mascot-bounce {
  0%   { transform: translate3d(-60vw, 60vh, 0) scale(0.5) rotate(-15deg); opacity: 0; }
  15%  { transform: translate3d(-10vw, -5vh, 0) scale(1.1) rotate(5deg); opacity: 1; }
  25%  { transform: translate3d(-8vw, 2vh, 0) scale(0.95) rotate(-3deg); opacity: 1; }
  40%  { transform: translate3d(5vw, -3vh, 0) scale(1.05) rotate(4deg); opacity: 1; }
  55%  { transform: translate3d(-3vw, 0, 0) scale(1.0) rotate(-2deg); opacity: 1; }
  75%  { transform: translate3d(8vw, -2vh, 0) scale(1.02) rotate(3deg); opacity: 1; }
  100% { transform: translate3d(60vw, 60vh, 0) scale(0.5) rotate(15deg); opacity: 0; }
}

/* Portal: warps in from deep Z, swirls, warps out forward */
@keyframes fx-portal-warp {
  0%   { transform: scale(0.1) translateZ(-800px) rotate(-180deg); opacity: 0; filter: blur(8px); }
  20%  { transform: scale(1.0) translateZ(0) rotate(-30deg); opacity: 1; filter: blur(0px); }
  50%  { transform: scale(1.05) translateZ(0) rotate(20deg); opacity: 1; filter: blur(0px); }
  80%  { transform: scale(1.1) translateZ(100px) rotate(60deg); opacity: 0.9; filter: blur(1px); }
  100% { transform: scale(2.0) translateZ(600px) rotate(180deg); opacity: 0; filter: blur(10px); }
}
`;
