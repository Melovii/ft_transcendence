import type { Team } from '@shared/types';
import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for Your Setup: the team buttons, the role cards and the Ready button's
 * geometry.
 *
 * The panel keeps one size everywhere, the desktop sidebar's at 80% of the design, so the
 * same controls fit the sidebar and the setup dialog that phones and tablets open. The
 * Ready button also sits in the page flow on phones and tablets, sized there by the page.
 */

export const panel: string = 'flex w-full flex-col items-stretch';

export const heading: string =
  'text-center text-[18px] leading-[18px] font-black text-text-ink uppercase';

export const teamHeading: string = heading;

export const roleHeading: string = `${heading} mt-[27px]`;

// ---- Team buttons ----

export const teams: string = 'mt-[15px] grid grid-cols-2 gap-[14px]';

export const teamButton: string =
  `${buttonInteraction} relative flex h-[55px] items-center justify-center rounded-[14px] ` +
  'text-[20px] leading-none font-bold text-surface disabled:opacity-60';

export const teamTone: Record<Team, string> = {
  RED:
    'bg-secondary-deep shadow-button-coral not-disabled:hover:brightness-105 ' +
    'not-disabled:hover:shadow-button-coral-hover',
  BLUE:
    'bg-primary shadow-button-primary not-disabled:hover:bg-primary-bright ' +
    'not-disabled:hover:shadow-button-primary-hover',
};

/** The check on the chosen team or role, in that team's accent color. */
export const check: string =
  'absolute -top-[9px] -right-[8px] inline-flex size-[27px] items-center justify-center ' +
  'rounded-pill border-2 border-surface text-[12px] text-surface';

export const checkTone: Record<Team, string> = {
  RED: 'bg-accent-red',
  BLUE: 'bg-primary-deep',
};

// ---- Role cards ----

export const roles: string = 'mt-[12px] grid grid-cols-2 gap-[14px]';

export const roleCard: string =
  `${buttonInteraction} relative h-[156px] rounded-[14px] border-[1.5px] border-disabled ` +
  'bg-surface text-center shadow-[0_5px_8px_var(--color-shadow-warm)] ' +
  'not-disabled:hover:shadow-[0_8px_12px_var(--color-shadow-warm)]';

export const roleCardSelected: string = 'border-[2.5px] bg-surface-raised';

export const roleCardSelectedTone: Record<Team, string> = {
  RED: 'border-accent-red',
  BLUE: 'border-primary-deep',
};

export const roleCardUnavailable: string = 'border-[2.5px]';

/** Dims the card's content only, so the TAKEN badge over it stays fully legible. */
export const roleContent: string = 'absolute inset-0 transition-opacity duration-200';

export const roleContentDimmed: string = 'opacity-55';

export const roleArtwork = {
  SPYMASTER: 'absolute top-[12px] left-[33px] h-[67px] w-[95px]',
  OPERATIVE: 'absolute top-[8px] left-[27px] h-[70px] w-[107px]',
};

export const roleTitle: string =
  'absolute inset-x-0 top-[84px] text-[18px] leading-[18px] font-black text-text-ink uppercase';

export const roleDescription: string =
  'absolute inset-x-[10px] top-[110px] text-[14px] leading-[17px] font-regular ' +
  'whitespace-pre-line text-text-ink';

export const takenBadge: string =
  'absolute top-[140px] left-1/2 inline-flex h-[27px] w-[74px] -translate-x-1/2 ' +
  'items-center justify-center rounded-[14px] bg-text-gray text-[14px] leading-none ' +
  'font-black text-surface uppercase';

export const hint: string =
  'mt-[12px] text-center text-[15px] leading-[18px] font-regular text-text-muted';

/** Watch instead: a quiet text action under the roles, so a seat is not dropped by habit. */
export const spectate: string = 'gap-[8px] text-[15px] leading-[18px] font-bold';

export const spectatePlacement: string = 'mx-auto mt-[10px]';

// ---- Ready ----

/** The shared `Button` draws the tone: primary to confirm, success once ready. */
export const ready: string = 'gap-[12px] leading-none font-bold';

/** Sidebar size; phones and tablets pass their own. */
export const readySidebar: string = 'h-[53px] rounded-[13px] text-[22px]';

export const readyMark: string =
  'inline-flex size-[24px] shrink-0 items-center justify-center rounded-pill bg-surface ' +
  'text-[12px] text-success-deep';

export const feedback: string =
  'flex items-start justify-center gap-2 text-center text-md leading-[18px] font-bold ' +
  'text-accent-red';

// ---- Setup summary (phones and tablets) ----

export const summary: string =
  'flex w-full items-center gap-2 rounded-md bg-surface-muted px-[12px] py-[6px] ' +
  'desktop:hidden';

export const summaryText: string =
  'min-w-0 flex-1 truncate text-md leading-[21px] font-bold text-text-ink md:text-lg';

export const summaryChange: string = 'text-xl leading-[21px] font-bold tracking-tight';

// ---- Setup dialog (phones and tablets) ----

export const dialog: string =
  'max-w-[390px] rounded-xl bg-surface-muted px-3 pt-[24px] pb-[24px] shadow-auth-dialog ' +
  'md:px-5';

export const dialogTitle: string =
  'mb-[20px] text-center text-[28px] leading-[28px] font-black text-text-ink uppercase';
