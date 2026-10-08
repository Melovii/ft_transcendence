/**
 * Class recipes for GAME HISTORY in the own Profile pop-up.
 *
 * Phones are the base, at the design's full size like the rest of the mobile pop-up; from
 * `md:` everything is the desktop design at 80%, the scale the pop-up uses there. Type the
 * design sets at 14px stays at 12px rather than 11px, so it stays readable.
 */

export const section: string = 'flex flex-col gap-[14px] md:gap-[11px]';

export const header: string = 'flex items-center gap-3';

export const heading: string =
  'flex-1 text-md leading-[22px] font-black tracking-[1px] text-text-gray uppercase ' +
  'md:text-sm md:leading-[18px]';

export const count: string =
  'text-md leading-[22px] font-regular text-text-muted md:text-sm md:leading-[18px]';

/** Three rows show; older games scroll into view and page in as they near the end. */
export const list: string =
  '-mx-1 flex max-h-[246px] flex-col gap-[10px] overflow-y-auto overscroll-contain px-1 ' +
  'pb-1 md:max-h-[196px] md:gap-[8px]';

export const row: string =
  'flex shrink-0 items-center gap-[14px] rounded-[18px] bg-surface-muted px-[16px] ' +
  'py-[12px] md:gap-[11px] md:rounded-[14px] md:px-[13px] md:py-[10px]';

export const resultBase: string =
  'inline-flex h-[30px] w-[76px] shrink-0 items-center justify-center rounded-[15px] ' +
  'text-[15px] leading-none font-black text-surface md:h-[24px] md:w-[61px] ' +
  'md:rounded-[12px] md:text-sm';

export const result = {
  WIN: 'bg-success-soft',
  LOSS: 'bg-secondary-deep',
};

export const info: string = 'flex min-w-0 flex-1 flex-col gap-[4px] md:gap-[3px]';

export const opponents: string =
  'truncate text-xl leading-[1.1] font-bold text-text-ink md:text-[16px]';

/** Wraps on phones, where the row is too narrow for it; one line from `md:`. */
export const meta: string =
  'text-md leading-[1.1] font-regular text-text-muted md:truncate md:text-sm';

export const scoreColumn: string = 'flex shrink-0 flex-col items-end gap-[4px] md:gap-[3px]';

export const score: string =
  'text-xl leading-[1.1] font-black whitespace-nowrap text-text-ink tabular-nums ' +
  'md:text-[16px]';

export const date: string =
  'text-md leading-[1.1] font-regular whitespace-nowrap text-text-muted md:text-sm';

// ---- Loading, empty and error ----

export const skeletonRow: string = `${row} h-[65px] md:h-[52px]`;

export const skeletonBadge: string = 'h-[30px] w-[76px] rounded-[15px] md:h-[24px] md:w-[61px]';

export const empty: string = 'flex flex-col items-center gap-[8px] py-[8px] text-center';

export const emptyIcon: string = 'text-[48px] text-text-disabled md:text-[38px]';

export const emptyTitle: string =
  'text-2xl leading-[1.3] font-black text-text-ink normal-case md:text-xl';

export const emptyBody: string =
  'max-w-[400px] text-md leading-[1.5] font-regular text-text-muted md:text-sm';

export const alert: string =
  'flex flex-col gap-[4px] rounded-[10px] bg-secondary-deep px-[14px] py-[8px] ' +
  'text-surface shadow-alert';

export const alertTitle: string = 'text-lg leading-[20px] font-bold md:text-md md:leading-[18px]';

export const alertBody: string = 'text-md leading-[18px] font-regular md:text-sm';

/** Try Again: the shared link `Button`, deepening its blue on hover. */
export const retry: string = 'text-lg leading-[21px] font-bold md:text-md';

export const retryPlacement: string = 'self-start hover:text-primary';
