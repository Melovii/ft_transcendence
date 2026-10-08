import type { Team } from '@shared/types';

/**
 * Class recipes for the Game Paused dialog. It shares the Leave Game dialog's card, title
 * and body type, and the board's team colors; phones are the base and `desktop:` draws it
 * at 80%, like the board behind it.
 */

export const card: string =
  'max-w-[520px] items-center rounded-xl bg-surface px-3 pt-[24px] pb-[20px] text-center ' +
  'shadow-auth-dialog md:rounded-2xl md:px-[32px] md:pt-[32px] md:pb-[26px] ' +
  'desktop:max-w-[464px] desktop:rounded-[28px] desktop:px-[29px] desktop:pt-[28px]';

export const badge: string =
  'flex size-[56px] items-center justify-center rounded-pill bg-secondary-deep text-[26px] ' +
  'text-surface shadow-button-coral desktop:size-[48px] desktop:text-[22px]';

export const title: string =
  'mt-[14px] text-3xl leading-[30px] font-black tracking-[-0.8px] text-text-black ' +
  'uppercase md:text-4xl md:leading-[32px] desktop:text-[26px] desktop:leading-[26px]';

export const body: string =
  'mt-[12px] max-w-[440px] text-lg leading-[22px] font-regular text-text-black ' +
  'md:text-xl md:leading-[26px] desktop:text-[17px] desktop:leading-[21px]';

export const teams: string = 'mt-[18px] flex w-full flex-col gap-[10px]';

export const team: string =
  'flex items-center justify-between gap-[12px] rounded-[16px] border-[1.5px] px-[14px] ' +
  'py-[10px] text-left';

export const teamTone: Record<Team, string> = {
  RED: 'border-secondary/40 bg-secondary/10 text-accent-red',
  BLUE: 'border-primary/40 bg-primary/10 text-primary-deep',
};

export const teamText: string = 'min-w-0 text-md leading-[20px] font-bold md:text-lg';

export const timer: string =
  'inline-flex shrink-0 items-center gap-[6px] text-2xl leading-none font-black ' +
  'tabular-nums desktop:text-[20px]';

export const claim: string = 'mt-[18px] flex w-full flex-col items-center gap-[10px]';

export const claimTitle: string =
  'text-md leading-[18px] font-black tracking-[0.6px] text-text-slate uppercase';

export const claimActions: string = 'flex w-full flex-wrap justify-center gap-[10px]';

/** In the team's color, like the Ready Room's team buttons. */
export const claimButton: string =
  'h-[46px] rounded-[14px] px-[14px] text-lg leading-none font-bold desktop:h-[42px] ' +
  'desktop:text-[16px]';

export const claimPlacement: string = 'min-w-0 flex-1 aria-disabled:opacity-60';

export const error: string = 'text-md leading-[18px] font-bold text-accent-red';

export const leave: string = 'gap-[8px] text-md leading-[20px] font-bold';
