// React hook + utilities for tracking online/offline state.
import { useEffect, useState } from "react";

export function getOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => getOnline());
  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);
  return online;
}

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => listeners.forEach((l) => l(true)));
  window.addEventListener("offline", () => listeners.forEach((l) => l(false)));
}

export function onConnectivityChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
