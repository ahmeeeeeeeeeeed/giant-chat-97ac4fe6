import { useEffect } from "react";

type EventCallback<T = any> = (data: T) => void;
const listeners = new Map<string, Set<EventCallback>>();

export const events = {
  emit<T = any>(event: string, data: T) {
    listeners.get(event)?.forEach((cb) => cb(data));
  },
  on<T = any>(event: string, callback: EventCallback<T>) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    return () => { listeners.get(event)?.delete(callback); };
  },
};

export function useEvent<T = any>(event: string, callback: EventCallback<T>) {
  useEffect(() => {
    return events.on(event, callback);
  }, [event, callback]);
}
