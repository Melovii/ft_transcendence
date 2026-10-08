import type { Team } from '@shared/types';
import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for the Ready Room team panels, player cards, empty seats and the players
 * spectating.
 *
 * Mobile (390px) is the base and `md:` the tablet layout (834px); `desktop:` is the 1920×1080
 * composition drawn at 80% of the design's size, like the rest of the desktop pages.
 */

// ---- Panel ----

export const panel: string =
  'flex w-full min-w-0 flex-col overflow-hidden rounded-lg border-[3px] bg-surface ' +
  'shadow-panel desktop:rounded-[16px] desktop:border-[2.5px]';

export const panelTone: Record<Team, string> = {
  RED: 'border-secondary-deep desktop:border-accent-red',
  BLUE: 'border-primary desktop:border-primary-deep',
};

export const header: string =
  'flex h-[38px] shrink-0 items-center justify-center text-2xl leading-none font-black ' +
  'text-surface uppercase md:h-[60px] md:text-3xl desktop:h-[58px] desktop:text-[30px]';

export const headerTone: Record<Team, string> = {
  RED: 'bg-secondary-deep',
  BLUE: 'bg-primary',
};

export const list: string =
  'flex flex-col gap-[6px] p-2 md:gap-[12px] md:p-[14px] desktop:gap-[14px] ' +
  'desktop:px-[27px] desktop:pt-[21px] desktop:pb-[25px]';

// ---- Player card ----

export const card: string =
  `${buttonInteraction} relative flex h-[76px] w-full min-w-0 items-center gap-[12px] ` +
  'rounded-lg border-[1.5px] border-surface-sunken bg-surface px-[12px] text-left ' +
  'shadow-[0_5px_8px_var(--color-shadow-warm)] ' +
  'not-disabled:hover:shadow-[0_8px_12px_var(--color-shadow-warm)] md:h-[96px] ' +
  'md:gap-[16px] md:px-[16px] desktop:h-[99px] desktop:gap-[14px] desktop:rounded-[14px] ' +
  'desktop:px-[14px]';

/** The player's own card carries their team's color, as the desktop design draws it. */
export const selfTone: Record<Team, string> = {
  RED: 'desktop:border-[2.5px] desktop:border-accent-red',
  BLUE: 'desktop:border-[2.5px] desktop:border-primary-deep',
};

export const avatarFrame: string = 'relative shrink-0';

export const avatar: string =
  'flex size-[52px] items-center justify-center overflow-hidden rounded-pill ' +
  'bg-accent-yellow-deep md:size-[68px] desktop:size-[67px]';

export const avatarImage: string = 'h-full w-full object-cover';

export const avatarPlaceholder: string = 'text-3xl text-text-black md:text-4xl';

export const onlineDot: string =
  'absolute right-0 bottom-0 size-[14px] rounded-pill border-2 border-surface ' +
  'bg-success-soft md:size-[18px] desktop:size-[14px]';

export const details: string =
  'flex min-w-0 flex-1 flex-col items-start gap-[7px] md:gap-[11px] desktop:gap-[9px]';

export const nameRow: string = 'flex max-w-full min-w-0 items-center gap-[8px] md:gap-[10px]';

export const name: string =
  'min-w-0 truncate text-2xl leading-[23px] font-black text-text-ink md:text-3xl ' +
  'md:leading-[27px] desktop:text-[26px] desktop:leading-[26px]';

export const hostBadge: string =
  'inline-flex h-[24px] shrink-0 items-center justify-center rounded-[12px] ' +
  'bg-primary-muted px-[10px] text-sm leading-none font-black text-surface uppercase ' +
  'md:h-[28px] md:px-[14px] md:text-md desktop:h-[28px] desktop:w-[58px] ' +
  'desktop:rounded-[14px] desktop:px-0';

export const roleBadge: string =
  'inline-flex h-[24px] max-w-full min-w-[112px] items-center gap-[6px] rounded-[12px] ' +
  'bg-surface-muted pr-[12px] pl-[8px] text-md leading-none font-bold text-text-ink ' +
  'md:h-[30px] md:min-w-[140px] md:rounded-[15px] md:pl-[10px] md:text-lg ' +
  'desktop:h-[28px] desktop:min-w-[124px] desktop:rounded-[14px] desktop:text-[16px]';

export const roleIcon: string = 'text-[12px] md:text-[15px] desktop:text-[14px]';

export const readyBadge: string =
  'inline-flex h-[32px] shrink-0 items-center gap-[6px] rounded-[16px] pr-[12px] ' +
  'pl-[7px] text-lg leading-none font-bold md:h-[44px] md:gap-[7px] md:rounded-[22px] ' +
  'md:pr-[16px] md:pl-[9px] md:text-xl desktop:h-[34px] desktop:min-w-[98px] ' +
  'desktop:gap-[6px] desktop:rounded-[18px] desktop:pr-[13px] desktop:pl-[8px] ' +
  'desktop:text-[16px]';

export const readyTone = {
  ready: 'bg-success-deep text-surface',
  waiting: 'bg-accent-yellow-deep text-accent-brown',
};

export const readyMark: string =
  'inline-flex size-[18px] shrink-0 items-center justify-center rounded-pill bg-surface ' +
  'text-[10px] md:size-[24px] md:text-[13px] desktop:size-[20px] desktop:text-[11px]';

export const readyMarkTone = {
  ready: 'text-success-deep',
  waiting: 'text-accent-brown',
};

// ---- Empty seat ----

export const emptySeat: string =
  'flex h-[76px] w-full items-center gap-[12px] rounded-lg border-2 border-border ' +
  'bg-surface-raised px-[12px] md:h-[96px] md:gap-[16px] md:px-[16px] desktop:h-[99px] ' +
  'desktop:gap-[14px] desktop:rounded-[14px] desktop:px-[14px]';

export const emptyAvatar: string =
  'size-[52px] shrink-0 rounded-pill bg-surface-muted md:size-[68px] desktop:size-[67px]';

export const emptyLabel: string =
  'truncate text-lg leading-none font-black text-text-muted md:text-2xl desktop:text-[18px]';

// ---- Kick (the host only) ----

/** Holds a card or chip and, for the host, the Kick button beside it. */
export const kickable: string = 'relative min-w-0';

/** A small round coral control on the card's corner, apart from the card's own press. */
export const kickSize: string = 'size-[30px] text-[13px]';

export const kick: string = 'absolute -top-[6px] -right-[6px] z-10 bg-surface shadow-button-muted';

// ---- Spectators ----

export const choosing: string = 'flex flex-col gap-2 desktop:gap-[10px]';

export const choosingTitle: string =
  'text-md leading-none font-black text-text-muted uppercase md:text-lg ' +
  'desktop:text-[15px] desktop:tracking-[0.4px]';

export const choosingList: string = 'flex flex-wrap gap-2';

export const chip: string =
  `${buttonInteraction} inline-flex h-[40px] max-w-full min-w-0 items-center gap-[8px] ` +
  'rounded-pill bg-surface pr-[14px] pl-[4px] text-lg leading-none font-bold text-text-ink ' +
  'shadow-[0_4px_7px_var(--color-shadow-warm-soft)] ' +
  'not-disabled:hover:shadow-[0_6px_10px_var(--color-shadow-warm-soft)]';

export const chipAvatar: string =
  'flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-pill ' +
  'bg-accent-yellow-deep';

export const chipPlaceholder: string = 'text-lg text-text-black';

export const chipName: string = 'min-w-0 truncate';
