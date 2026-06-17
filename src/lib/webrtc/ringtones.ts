// Simple Web Audio API-generated ringtone and dial tone. No external assets.
// Loops automatically until stop() is called.

type Stopper = () => void;

function makeCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!C) return null;
  try { return new C(); } catch { return null; }
}

/** Incoming-call ringtone: two-tone, repeats every 3s. */
export function playRingtone(): Stopper {
  const ctx = makeCtx();
  if (!ctx) return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const playOnce = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    const tones: Array<[number, number, number]> = [
      [440, now, 0.4],
      [554, now + 0.45, 0.4],
      [440, now + 1.0, 0.4],
      [554, now + 1.45, 0.4],
    ];
    tones.forEach(([freq, t0, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
    timer = setTimeout(playOnce, 3000);
  };

  // Vibrate on mobile while ringing.
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate([600, 400, 600, 400, 600]); } catch { /* noop */ }
    const vibInt = setInterval(() => { try { navigator.vibrate?.([600, 400, 600, 400, 600]); } catch { /* noop */ } }, 3000);
    const origStop = () => { clearInterval(vibInt); };
    playOnce();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      origStop();
      try { navigator.vibrate?.(0); } catch { /* noop */ }
      ctx.close().catch(() => {});
    };
  }

  playOnce();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    ctx.close().catch(() => {});
  };
}

/** Outgoing dial tone: low pulse every 2s. */
export function playDialTone(): Stopper {
  const ctx = makeCtx();
  if (!ctx) return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const playOnce = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 420;
    osc.type = "sine";
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1);
    timer = setTimeout(playOnce, 2000);
  };

  playOnce();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    ctx.close().catch(() => {});
  };
}
