import type { Team } from '@shared/types';

/**
 * Team lineup recipes. The desktop card is the design system's Team Status Card (220×300
 * in the 1920px design, drawn at 80%); the summary is the two-line lineup at the foot of
 * the phone and tablet board.
 */

export const tones: Record<Team, { title: string; label: string; summary: string }> = {
  RED: { title: 'text-accent-red', label: 'text-accent-brick', summary: 'text-secondary-deep' },
  BLUE: { title: 'text-primary-deep', label: 'text-primary-ink', summary: 'text-primary' },
};

export const card: string =
  'flex w-[176px] min-h-[240px] flex-col items-center rounded-[14px] bg-surface px-[6px] ' +
  'pt-[14px] pb-[16px] shadow-[0_5px_7px_var(--color-shadow-warm)]';

export const cardTitle: string = 'text-[22px] leading-none font-black uppercase';

export const roleLabel: string =
  'mt-[13px] text-[9px] leading-none font-black tracking-[1px] uppercase';

export const players: string = 'mt-[10px] flex flex-wrap justify-center gap-x-[18px] gap-y-[8px]';

export const player: string =
  'flex w-[56px] cursor-pointer flex-col items-center gap-[5px] rounded-md ' +
  'transition-[scale] duration-100 ease-in motion-safe:hover:scale-105 ' +
  'motion-safe:active:scale-95';

/** Holds a player and, for the Room Owner, the Kick button on their avatar's corner. */
export const kickable: string = 'relative';

/** Kick: the shared coral outline `ButtonIcon`, raised on the player's corner. */
export const kickSize: string = 'size-[22px] text-[10px]';

export const kick: string = 'absolute -top-[4px] -right-[4px] z-10 bg-surface shadow-button-muted';

export const avatar: string =
  'flex h-[43px] w-[43px] items-center justify-center overflow-hidden rounded-pill ' +
  'bg-surface-muted shadow-avatar';

export const avatarImage: string = 'h-full w-full object-cover';

export const avatarPlaceholder: string = 'text-xl text-text-disabled';

export const playerName: string =
  'block max-w-full truncate text-[10px] leading-none font-bold text-text-ink';

export const divider: string = 'mt-[14px] h-px w-[131px] bg-disabled';

export const summary: string =
  'flex min-w-0 flex-1 flex-col gap-[2px] rounded-md bg-surface p-[10px]';

export const summaryTitle: string = 'text-md leading-[22px] font-black uppercase';

export const summaryLine: string = 'text-sm leading-[19px] font-bold text-text-ink';
