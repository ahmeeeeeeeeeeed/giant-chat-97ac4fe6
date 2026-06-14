// Bell badge counter: increments on every incoming global notification,
// and resets when the user opens the notifications page.
import { useEffect, useState } from "react";

const KEY = "giant:bellCount";
const EVENT = "giant:bell-count-changed";

function read(): number {
  try {
    const v = localStorage.getItem(KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function write(n: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, n)));
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: n }));
  } catch { /* ignore */ }
}

export function bumpBellCount(): void {
  write(read() + 1);
}

export function resetBellCount(): void {
  write(0);
}

export function useBellCount(): number {
  const [count, setCount] = useState<number>(() => (typeof window === "undefined" ? 0 : read()));

  useEffect(() => {
    const onChange = () => setCount(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    setCount(read());
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return count;
}
