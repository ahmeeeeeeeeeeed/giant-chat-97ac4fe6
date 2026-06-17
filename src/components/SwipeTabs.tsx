import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";

type Props = {
  /** Ordered list of tab root paths (visual order in the bottom nav, LTR sense). */
  tabRoots: readonly string[];
  children: ReactNode;
};

/**
 * Wraps tab content and lets the user swipe horizontally to move between
 * tab roots — in addition to the bottom nav buttons (not a replacement).
 *
 * Activation rules (to avoid hijacking real horizontal scrolls inside chats,
 * carousels, sliders, etc.):
 *  - only active when current path === one of the tab roots
 *  - ignores gestures that start on interactive/scrollable elements
 *  - requires a clearly horizontal, fast-enough flick
 */
export function SwipeTabs({ tabRoots, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const startRef = useRef<{ x: number; y: number; t: number; valid: boolean } | null>(null);

  useEffect(() => {
    const MIN_DX = 70;     // px — minimum horizontal travel
    const MAX_DY = 50;     // px — maximum vertical drift
    const MAX_MS = 600;    // ms — must be a flick, not a slow drag
    const EDGE_IGNORE = 16; // ignore swipes that begin at the very screen edge (system back/refresh)

    const isInteractiveStart = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      // Skip swipes that start inside something the user is likely interacting with
      // horizontally on purpose: sliders, carousels, scrollable rows, inputs, audio/video.
      if (target.closest(
        'input,textarea,select,button,a,[role="slider"],[role="tablist"],' +
        '[data-swipe-ignore],audio,video,canvas,.swiper,.embla,' +
        '[data-radix-scroll-area-viewport]'
      )) return true;
      // Walk up looking for an element that scrolls horizontally.
      let el: Element | null = target;
      while (el && el !== document.body) {
        const cs = window.getComputedStyle(el);
        const ox = cs.overflowX;
        if ((ox === "auto" || ox === "scroll") && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startRef.current = null; return; }
      const t = e.touches[0];
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      const onTabRoot = (tabRoots as readonly string[]).includes(path);
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
      const dt = Date.now() - s.t;
      if (dt > MAX_MS) return;
      if (Math.abs(dx) < MIN_DX) return;
      if (Math.abs(dy) > MAX_DY) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.6) return;

      const path = window.location.pathname.replace(/\/$/, "") || "/";
      const idx = (tabRoots as readonly string[]).indexOf(path);
      if (idx < 0) return;

      // Respect document direction: in RTL, swipe-right = next, swipe-left = previous.
      const isRTL = (document.documentElement.getAttribute("dir") || "ltr").toLowerCase() === "rtl";
      const goingNext = isRTL ? dx > 0 : dx < 0;
      const nextIdx = goingNext ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= tabRoots.length) return;

      navigate({ to: tabRoots[nextIdx] as any });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", () => { startRef.current = null; }, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [navigate, tabRoots, location.pathname]);

  return <>{children}</>;
}
