import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside `ref` while `active` is true, moves focus into it on
 * mount and returns focus to the previously focused element on unmount.
 *
 * This is what makes a dialog usable from the keyboard: Tab cycles within the dialog
 * instead of walking the page behind it.
 *
 * Focus lands on the first control, or on the container itself with
 * `initialFocus: 'container'` — for an overlay that appears on its own, where a key the
 * player was already pressing must not trigger its first button.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active = true,
  initialFocus: 'first' | 'container' = 'first',
): void {
  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    const first = initialFocus === 'first' ? focusables()[0] : undefined;
    (first ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [ref, active, initialFocus]);
}
