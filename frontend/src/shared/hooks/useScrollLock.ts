import { useEffect } from 'react';

/** How many mounted overlays hold the page still, and the styles they will restore. */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

/**
 * Holds the page behind an overlay still while `active` is true. Where the scrollbar takes
 * up room, its width is kept as padding so the page does not shift sideways.
 *
 * Overlays can stack (a dialog under the Reconnecting overlay) and close in any order, so
 * the lock is counted: the first one saves the page's styles and the last one restores them.
 */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) {
      const { overflow, paddingRight } = document.body.style;
      saved = { overflow, paddingRight };
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0 && saved) {
        document.body.style.overflow = saved.overflow;
        document.body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}
