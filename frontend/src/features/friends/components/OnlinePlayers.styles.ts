import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for Players Online in Room Discovery.
 *
 * Mobile and tablet are the base: a centered heading over a row of cards that scrolls
 * sideways. From `desktop:` the heading sits on the left and the row shows four cards and
 * Show More, at 80% of the design's size like the rest of the desktop page.
 */

export const heading: string =
  'relative flex flex-wrap items-center justify-center gap-[7px] desktop:justify-start';

/**
 * Friends: beside the centered heading on phones, at the row's far end from tablets on,
 * whatever the heading's own alignment.
 */
export const friendsButton: string = 'md:absolute md:right-0 desktop:static desktop:ml-auto';

export const title: string =
  'text-2xl leading-[37px] font-black text-text-ink normal-case desktop:text-[33px] ' +
  'desktop:leading-[33px]';

/** The ring is drawn at its full size but takes no height, so the heading does not move. */
export const loader: string = '-my-4 scale-75 desktop:scale-[0.8]';

/** The row runs to the screen edges and snaps its cards to the page gutter. */
export const row: string =
  '-mx-3 mt-[14px] flex snap-x scroll-px-3 gap-[12px] overflow-x-auto px-3 pt-[2px] ' +
  'pb-[10px] md:-mx-6 md:scroll-px-6 md:px-6 desktop:mx-0 desktop:mt-[14px] ' +
  'desktop:gap-[21px] desktop:overflow-visible desktop:px-0 desktop:pt-0 desktop:pb-0';

export const rowExpanded: string = 'desktop:flex-wrap desktop:gap-y-[16px]';

/** Past the fourth card, desktop waits for Show More; the scrolling row shows them all. */
export const desktopOverflow: string = 'desktop:hidden';

// ---- Cards ----

export const card: string =
  'relative block h-[79px] w-[250px] shrink-0 snap-start rounded-md bg-surface shadow-panel ' +
  'desktop:h-[63px] desktop:w-[200px] desktop:rounded-[11px]';

export const playerCard: string = `${buttonInteraction} text-left not-disabled:hover:shadow-[0_8px_12px_var(--color-shadow-warm-soft)]`;

export const avatar: string =
  'absolute top-[12px] left-[12px] flex size-[55px] items-center justify-center ' +
  'overflow-hidden rounded-pill bg-secondary-deep desktop:top-[10px] desktop:left-[10px] ' +
  'desktop:size-[44px]';

export const avatarImage: string = 'h-full w-full object-cover';

export const avatarPlaceholder: string = 'text-2xl text-surface';

export const name: string =
  'absolute top-[15px] right-[12px] left-[77px] truncate text-[22px] leading-[24px] ' +
  'font-black text-text-ink desktop:top-[11px] desktop:right-[10px] desktop:left-[62px] ' +
  'desktop:text-[18px] desktop:leading-[20px]';

export const badge: string =
  'absolute top-[45px] left-[77px] inline-flex h-[25px] items-center gap-[5px] ' +
  'rounded-[13px] bg-accent-mint-deep pr-[10px] pl-[8px] text-[16px] leading-none ' +
  'font-bold text-success-deep desktop:top-[36px] desktop:left-[62px] desktop:h-[20px] ' +
  'desktop:gap-[4px] desktop:pr-[8px] desktop:pl-[6px] desktop:text-[13px]';

export const badgeDot: string = 'size-[9px] rounded-pill bg-success-deep desktop:size-[7px]';

export const skeletonCard: string = 'list-none';

const skeleton: string = 'absolute block motion-safe:animate-pulse';

export const skeletonAvatar: string =
  `${skeleton} top-[12px] left-[12px] size-[55px] rounded-pill bg-surface-sunken ` +
  'desktop:top-[10px] desktop:left-[10px] desktop:size-[44px]';

export const skeletonName: string =
  `${skeleton} top-[20px] left-[77px] h-[14px] w-[120px] rounded-[7px] bg-surface-sunken ` +
  'desktop:top-[16px] desktop:left-[62px] desktop:h-[11px] desktop:w-[96px]';

export const skeletonStatus: string =
  `${skeleton} top-[46px] left-[77px] h-[14px] w-[70px] rounded-[7px] bg-disabled ` +
  'desktop:top-[37px] desktop:left-[62px] desktop:h-[11px] desktop:w-[56px]';

export const showMoreItem: string = 'hidden shrink-0 desktop:block';

export const showMore: string =
  `${buttonInteraction} flex h-[66px] w-[73px] items-center justify-center rounded-[11px] ` +
  'border border-(length:--stroke-thin) border-border text-center text-[16px] leading-[16px] ' +
  'font-bold whitespace-pre-line text-text-ink not-disabled:hover:bg-surface';

// ---- Empty and error notice ----

export const notice: string =
  'mt-[14px] flex flex-col items-start gap-3 rounded-lg border border-(length:--stroke-thin) ' +
  'border-border bg-surface-raised p-4 motion-safe:animate-rise-in md:flex-row ' +
  'md:items-center md:gap-[20px] md:px-5 desktop:mt-[14px] desktop:min-h-[97px] ' +
  'desktop:gap-[16px] desktop:px-[26px]';

export const noticeIcon: string = 'shrink-0 text-[36px] text-text-muted desktop:text-[36px]';

export const noticeCopy: string = 'flex min-w-0 flex-1 flex-col gap-[4px]';

export const noticeTitle: string =
  'text-xl leading-[26px] font-black text-text-ink desktop:text-xl desktop:leading-[30px]';

export const noticeBody: string =
  'text-md leading-[20px] font-regular text-text-muted desktop:text-md desktop:leading-[23px]';

export const noticeAction: string =
  `${buttonInteraction} inline-flex h-[43px] shrink-0 items-center gap-[9px] rounded-[22px] ` +
  'bg-surface px-[16px] text-lg leading-none font-bold whitespace-nowrap text-text-ink ' +
  'shadow-panel not-disabled:hover:shadow-[0_8px_12px_var(--color-shadow-warm-soft)]';
