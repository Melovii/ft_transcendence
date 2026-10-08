import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for received room invitations.
 *
 * They stack in the bottom-left corner, clear of the desktop chat launcher in the
 * bottom-right, on the Players Online card surface. On phones they span the width; the
 * chat launcher sits in the header there.
 */

export const stack: string =
  'fixed inset-x-3 bottom-3 z-(--z-toast) flex flex-col gap-2 md:right-auto md:left-6 ' +
  'md:w-[360px]';

export const card: string =
  'flex flex-col gap-[10px] rounded-md bg-surface p-[12px] shadow-modal motion-safe:animate-rise-in';

export const top: string = 'flex items-center gap-[10px]';

export const icon: string =
  'flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-primary-sky ' +
  'text-lg text-surface';

export const copy: string = 'flex min-w-0 flex-col gap-[2px]';

export const title: string = 'text-lg leading-[22px] font-black text-text-ink normal-case';

export const body: string = 'text-sm leading-[18px] font-regular text-text-muted';

export const code: string = 'font-bold tracking-[1px] text-text-ink';

export const actions: string = 'flex gap-[8px]';

/** Join: the shared primary `Button` at the notice's geometry. */
export const join: string = 'h-[38px] gap-[6px] rounded-[14px] text-md leading-none font-bold';

export const joinPlacement: string = 'flex-1 aria-disabled:opacity-70';

export const dismiss: string =
  `${buttonInteraction} inline-flex h-[38px] items-center justify-center rounded-[14px] ` +
  'bg-surface-muted px-[14px] text-md leading-none font-bold text-text-slate ' +
  'not-disabled:hover:bg-surface-sunken not-disabled:hover:text-text-ink';

export const error: string = 'text-sm leading-[18px] font-bold text-accent-red';
