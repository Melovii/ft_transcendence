/**
 * Match history recipes: a quiet panel under the board, closed by default so it never
 * covers a card, with the newest action on one line and the whole log one press away.
 */

export const log: string =
  'w-full rounded-lg bg-surface px-[12px] py-[10px] shadow-[0_4px_8px_var(--color-shadow-warm)] ' +
  'desktop:rounded-[16px] desktop:px-[18px]';

/** Keyboard focus is the document-wide ring. */
export const toggle: string =
  'flex w-full items-center gap-[8px] rounded-md text-left text-md leading-none font-black ' +
  'text-text-ink uppercase';

export const toggleIcon: string = 'text-text-muted';

export const count: string =
  'rounded-pill bg-surface-muted px-[8px] py-[3px] text-sm leading-none font-bold text-text-muted';

export const chevron: string =
  'ml-auto text-text-muted transition-transform motion-reduce:transition-none';

export const chevronOpen: string = 'rotate-180';

export const latest: string = 'mt-[8px] truncate text-sm leading-[18px] font-bold text-text-muted';

export const list: string =
  'mt-[10px] flex max-h-[220px] flex-col gap-[6px] overflow-y-auto pr-[4px] desktop:max-h-[260px]';

export const entry: string =
  'flex items-start gap-[8px] text-sm leading-[18px] font-bold text-text-ink';

export const dot: string = 'mt-[5px] size-[8px] shrink-0 rounded-full';

export const dotTone = {
  RED: 'bg-secondary',
  BLUE: 'bg-primary',
  NEUTRAL: 'bg-text-disabled',
} as const;

export const time: string = 'ml-auto shrink-0 text-xs leading-[18px] font-bold text-text-faint';

export const empty: string = 'mt-[8px] text-sm leading-[18px] font-bold text-text-muted';
