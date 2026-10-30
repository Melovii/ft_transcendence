import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Is `element` laid out, i.e. not inside something hidden at this breakpoint? */
const isVisible = (element: HTMLElement): boolean => element.getClientRects().length > 0;

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
 *
 * `companions` selects elements outside the container that stay usable beside it, such
 * as a widget drawn above the dialog: Tab continues from the container's last control
 * into them and from their last control back to the container's first.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active = true,
  initialFocus: 'first' | 'container' = 'first',
  companions?: string,
): void {
  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    const companionFocusables = (): HTMLElement[] =>
      companions
        ? Array.from(document.querySelectorAll<HTMLElement>(companions))
            .flatMap((element) => [
              ...(element.matches(FOCUSABLE) ? [element] : []),
              ...element.querySelectorAll<HTMLElement>(FOCUSABLE),
            ])
            .filter(isVisible)
        : [];

    const first = initialFocus === 'first' ? focusables()[0] : undefined;
    (first ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusables();
      const extra = companionFocusables();
      if (items.length === 0 && extra.length === 0) {
        event.preventDefault();
        return;
      }

      const current = document.activeElement;
      const inContainer = current === container || container.contains(current);
      const inCompanion = extra.some((element) => element === current);
      // Focus that is elsewhere, such as in a dialog opened above this one, is not ours.
      if (!inContainer && !inCompanion) return;

      const ring = [...items, ...extra];
      const firstItem = ring[0]!;
      const lastItem = ring[ring.length - 1]!;
      // Where focus leaves one group, it enters the other one, in the order of `ring`.
      const target = event.shiftKey
        ? current === container || current === firstItem
          ? lastItem
          : current === extra[0] && items.length > 0
            ? items[items.length - 1]
            : undefined
        : current === lastItem
          ? firstItem
          : current === items[items.length - 1] && extra.length > 0
            ? extra[0]
            : undefined;

      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [ref, active, initialFocus, companions]);
}
