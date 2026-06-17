import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

type Props = {
  /** Ordered list of tab root paths (visual order in the bottom nav, LTR sense). */
  tabRoots: readonly string[];
  children: ReactNode;
};

/**
 * Wraps tab content and lets the user swipe horizontally to move between
 * tab roots — in addition to the bottom nav buttons (not a replacement).
 *
 * Tuned for responsiveness: lower distance, more time, looser angle ratio,
 * and a velocity fallback so even slower drags still feel intentional.
 * Listeners are bound ONCE (not on every navigation) — tabRoots reads via ref.
 */
export function SwipeTabs({ tabRoots, children }: Props) {
  const navigate = useNavigate();
  const tabRootsRef = useRef(tabRoots);
  tabRootsRef.current = tabRoots;
  const startRef = useRef<{ x: number; y: number; t: number; valid: boolean } | null>(null);

  useEffect(() => {
    const MIN_DX = 45;          // px (was 70)
    const MAX_DY = 70;          // px (was 50)
    const MAX_MS = 900;         // ms (was 600)
    const MIN_VELOCITY = 0.25;  // px/ms — fallback for short but quick swipes
    const EDGE_IGNORE = 16;

    const isInteractiveStart = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (target.closest(
        'input,textarea,select,button,a,[role="slider"],[role="tablist"],' +
        '[data-swipe-ignore],audio,video,canvas,.swiper,.embla,' +
        '[data-radix-scroll-area-viewport]'
      )) return true;
      let el: Element | null = target;
      let hops = 0;
      while (el && el !== document.body && hops < 8) {
        const cs = window.getComputedStyle(el);
        const ox = cs.overflowX;
        if ((ox === "auto" || ox === "scroll") && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth) {
          return true;
        }
        el = el.parentElement;
        hops++;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startRef.current = null; return; }
      const t = e.touches[0];
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      const onTabRoot = tabRootsRef.current.includes(path);
      const nearEdge = t.clientX < EDGE_IGNORE || t.clientX > window.innerWidth - EDGE_IGNORE;
      const interactive = isInteractiveStart(e.target);
      startRef.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        valid: onTabRoot && !nearEdge && !interactive,
      };
    };

    const onEnd = (e: TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      if (!s || !s.valid) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Math.max(1, Date.now() - s.t);
      if (dt > MAX_MS) return;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const velocity = absDx / dt;
      if (absDx < MIN_DX && velocity < MIN_VELOCITY) return;
      if (absDy > MAX_DY) return;
      if (absDx < absDy * 1.2) return;

      const path = window.location.pathname.replace(/\/$/, "") || "/";
      const idx = tabRootsRef.current.indexOf(path);
      if (idx < 0) return;

      const isRTL = (document.documentElement.getAttribute("dir") || "ltr").toLowerCase() === "rtl";
      const goingNext = isRTL ? dx > 0 : dx < 0;
      const nextIdx = goingNext ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= tabRootsRef.current.length) return;

      navigate({ to: tabRootsRef.current[nextIdx] as any });
    };

    const onCancel = () => { startRef.current = null; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
