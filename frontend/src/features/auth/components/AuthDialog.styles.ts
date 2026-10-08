import { buttonInteraction } from '@shared/ui';

import type { AuthMode } from './AuthDialog.types';

/**
 * Class recipes for the Log In and Sign Up dialog.
 *
 * The dialog is a compact card over the dimmed Landing page at every width, as tall as
 * its form needs; the shared `Dialog` shell draws the backdrop and the close button.
 * Mobile is the base: the card spans the screen less a 16px margin on each side and
 * centers its header. From `md:` it is 440px wide, with the mascot beside a left-aligned
 * header and the design's artwork around the form.
 */

// ---- Surface ----

export const dialog: string =
  'max-w-[440px] items-center rounded-xl bg-linear-to-l from-surface-raised to-background ' +
  'px-[14px] pt-[18px] pb-[20px] shadow-auth-dialog md:rounded-2xl md:px-0 md:pt-[46px] ' +
  'md:pb-[38px]';

/** The title keeps clear of the close button: centered on mobile, beside the mascot above. */
export const title: string =
  'w-full px-[42px] text-center text-4xl leading-[38px] font-black tracking-[-0.8px] ' +
  'text-text-ink normal-case md:mr-[56px] md:ml-[150px] md:w-auto md:self-start md:px-0 ' +
  'md:text-left md:text-text';

export const subtitle: string =
  'mt-[6px] w-full text-center text-lg leading-[22px] font-regular text-text-muted ' +
  'md:ml-[150px] md:w-[240px] md:self-start md:text-left md:text-text-ink';

/** Artwork around the 440px dialog, at the design's placement scaled to that width. */
const artwork: string = 'pointer-events-none absolute hidden max-w-none md:block';

export const mascot: string = `${artwork} top-[26px] left-[16px] h-[127px] w-[127px]`;
export const cards: string = `${artwork} top-[84px] left-[359px] h-[69px] w-[67px]`;
export const foxPeek: string = `${artwork} top-[222px] left-[408px] h-[61px] w-[38px]`;
export const alien: string = `${artwork} bottom-[-4px] left-[10px] h-[60px] w-[64px]`;
export const foxCorner: string = `${artwork} bottom-[-1px] left-[389px] h-[50px] w-[51px]`;

// ---- Form card ----

export const card: string =
  'mt-[20px] flex w-full flex-col rounded-lg bg-surface p-[14px] shadow-auth-form-compact ' +
  'md:w-[376px] md:px-[18px] md:py-[18px] md:shadow-auth-form';

export const tabs: string =
  'relative grid h-12 w-full shrink-0 grid-cols-2 rounded-[26px] bg-surface-muted p-[2px]';

/** The active pill slides under the selected tab. */
export const tabIndicator: Record<AuthMode, string> = {
  login: '',
  register: 'translate-x-full',
};

export const tabIndicatorBase: string =
  'pointer-events-none absolute top-[2px] bottom-[2px] left-[2px] w-[calc(50%-2px)] ' +
  'rounded-[24px] bg-linear-to-b from-primary-bright to-primary-sky shadow-auth-tab ' +
  'transition-transform duration-200 ease-pop';

export const tab: string =
  'relative cursor-pointer rounded-[24px] text-xl leading-[20px] font-bold text-text-gray ' +
  'transition-colors duration-200 hover:text-text-slate ' +
  'aria-selected:text-surface aria-selected:hover:text-surface';

// ---- Fields ----

/** Log In has two fields and room between them; Register fits four. */
export const fields: Record<AuthMode, string> = {
  login: 'gap-[14px]',
  register: 'gap-[10px]',
};

export const fieldsBase: string = 'mt-[14px] flex flex-col';

export const field: string = 'flex flex-col gap-[6px]';

export const label: string = 'w-fit text-lg leading-[20px] font-bold text-text-ink';

export const controlBase: string =
  'h-12 w-full min-w-0 rounded-md border bg-surface-raised ' +
  'transition-[border-color,box-shadow,background-color] duration-200 ease-out ' +
  'placeholder:text-text-gray';

export const controlStatus = {
  default:
    'border-(length:--stroke-default) border-border shadow-alert hover:border-primary-deep ' +
    'focus:border-primary',
  error: 'border-2 border-secondary-dark shadow-input-error',
  success: 'border-2 border-success-soft shadow-alert',
};

export const controlLeading: string = 'pl-11';

export const controlPlain: string = 'pl-[14px]';

export const controlTrailing: string = 'pr-12';

/** Type of a visible value; a hidden password shows as the design's wide slate dots. */
export const controlText: string = 'text-lg font-medium text-text-ink';

export const masked: string = 'text-[22px] font-bold tracking-[2px] text-text-slate';

export const leadingIcon: string =
  'pointer-events-none absolute left-[15px] text-lg text-text-slate';

export const visibilityToggle: string =
  'absolute right-[6px] inline-flex h-9 w-9 cursor-pointer items-center justify-center ' +
  'rounded-pill text-lg text-text-slate transition-colors duration-100 ' +
  'hover:bg-surface-muted hover:text-text-ink';

export const message: string =
  'flex items-center gap-2 text-md leading-[18px] font-regular text-accent-red';

export const messageBadge: string =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-pill bg-accent-red ' +
  'text-[10px] text-surface';

// ---- Alert ----

export const alertTone = {
  error: 'bg-secondary-deep',
  success: 'bg-success-deep',
};

export const alertBase: string =
  'flex flex-col gap-[4px] rounded-[10px] px-[14px] py-[8px] text-surface shadow-alert ' +
  'motion-safe:animate-rise-in';

export const alertTitle: string = 'text-lg leading-[20px] font-bold tracking-[-0.5px]';

export const alertBody: string = 'text-md leading-[18px] font-regular tracking-[-0.35px]';

// ---- Actions ----

/** The form's submit: the shared primary `Button` at the dialog's geometry. */
export const submit: string = 'h-12 rounded-lg text-2xl leading-tight font-bold whitespace-nowrap';

export const submitPlacement: Record<AuthMode, string> = {
  login: 'mt-[20px] shrink-0',
  register: 'mt-[16px] shrink-0',
};

/** "or" between the form and Continue with Google. */
export const oauthDivider: string =
  'mt-[14px] flex items-center gap-[10px] text-md leading-none font-bold text-text-gray ' +
  'uppercase';

export const oauthDividerLine: string = 'h-[2px] flex-1 rounded-pill bg-surface-muted';

/** Continue with Google: the neutral button with Google's mark, a peer of the form's submit. */
export const google: string =
  `${buttonInteraction} mt-[12px] inline-flex h-12 w-full shrink-0 items-center ` +
  'justify-center gap-[10px] rounded-lg border-(length:--stroke-default) border-border ' +
  'bg-surface text-xl leading-tight font-bold whitespace-nowrap text-text-ink ' +
  'shadow-button-neutral not-aria-disabled:hover:bg-surface-raised ' +
  'not-aria-disabled:hover:shadow-button-neutral-hover aria-disabled:cursor-default ' +
  'aria-disabled:opacity-70';

export const googleMark: string = 'size-[20px] shrink-0';

/** A notice about how the dialog was reached, such as a failed Google sign-in. */
export const notice: string = 'mb-[12px]';

export const prompt: string =
  'mt-[14px] text-center text-md leading-[20px] font-bold text-text-ink md:text-lg ' +
  'md:leading-[22px] md:font-regular';

export const promptAction: string =
  'cursor-pointer rounded-sm hover:text-primary-sky hover:underline hover:underline-offset-2';

/** The large switch button. Mobile Register shows only the prompt line. */
export const switchButton: Record<AuthMode, string> = {
  login: '',
  register: 'max-md:hidden',
};

export const switchButtonBase: string = 'mt-[10px] w-full shrink-0 md:w-[376px]';
