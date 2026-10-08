import type { Team } from '@shared/types';

/** The turn heading: 23px in the team's color on phones and tablets, 36px on desktop. */

export const heading: string =
  'text-center text-2xl leading-[37px] font-black uppercase desktop:text-[36px] ' +
  'desktop:leading-none desktop:text-text-ink';

export const compactTone: Record<Team, string> = {
  RED: 'text-secondary-deep',
  BLUE: 'text-primary',
};

export const wideTone: Record<Team, string> = {
  RED: 'desktop:text-secondary-deep',
  BLUE: 'desktop:text-primary',
};

/** The turn timer under the heading: a muted pill that turns red in the last seconds. */
export const timer: string =
  'mt-[8px] inline-flex items-center gap-[6px] self-center rounded-pill bg-surface-muted ' +
  'px-[12px] py-[4px] text-md leading-none font-black text-text-slate tabular-nums ' +
  'desktop:mt-[12px] desktop:px-[14px] desktop:py-[6px] desktop:text-lg';

export const timerUrgent: string = 'bg-secondary-deep text-surface';
