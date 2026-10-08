import type { CardColor } from '@shared/types';

/**
 * Class recipes for the board tile, matching the design system's word cards.
 *
 * A hidden card is the patterned base face: the muted tile with a raised inner face and
 * the diagonal pattern. A team card is its team's fill with a light inner ring, a neutral
 * card is white with a grey outline, and the assassin is the dark card with the skull.
 * The tile keeps the board's three designed proportions: 66×72 on a phone, 138×96 on a
 * tablet and 190×112 on the desktop board, which is drawn at 80% like the rest of the
 * desktop composition.
 */

export type WordCardFace = CardColor | 'HIDDEN';

export const card: string =
  'relative flex w-full min-w-0 items-center justify-center overflow-hidden rounded-sm ' +
  'text-center uppercase leading-none aspect-[66/72] md:aspect-[138/96] md:rounded-md ' +
  'desktop:aspect-[190/112] desktop:rounded-[11px] ' +
  'transition-[translate,scale,box-shadow,opacity,border-color] duration-200 ease-pop';

export const faces: Record<WordCardFace, string> = {
  HIDDEN:
    'border-(length:--stroke-default) border-border bg-surface-muted font-bold ' +
    'text-text-black shadow-word-card',
  BLUE: 'bg-primary-sky font-black text-surface shadow-team-a',
  RED: 'bg-secondary-deep font-black text-surface shadow-team-b',
  NEUTRAL:
    'border-(length:--stroke-thin) border-text-disabled bg-surface font-black text-text ' +
    'shadow-[0_6px_12px_var(--color-shadow-warm-deep)]',
  ASSASSIN: 'bg-card-danger font-black text-error shadow-danger',
};

/** The inner face of a hidden card, and the light ring inside a team card. */
export const inner: string =
  'pointer-events-none absolute inset-[3px] rounded-[5px] md:inset-[6px] md:rounded-[9px]';

export const innerFaces: Partial<Record<WordCardFace, string>> = {
  HIDDEN:
    'border-(length:--stroke-medium) border-surface-raised bg-surface-muted bg-size-[100%_100%] ' +
    'bg-no-repeat md:border-(length:--stroke-strong)',
  BLUE: 'border-(length:--stroke-medium) border-surface/92',
  RED: 'border-(length:--stroke-medium) border-surface/92',
};

export const word: string =
  'relative block max-w-full px-[3px] text-[10px] break-words [overflow-wrap:anywhere] ' +
  'md:px-2 md:text-lg desktop:text-lg';

export const skull: string = 'relative mb-[3px] h-[36%] w-auto md:mb-1 desktop:mb-[5px]';

export const assassinLayout: string = 'flex-col';

/** Emphasis levels of the designed boards (see `cardEmphasis` in the game feature). */
export const emphasis = {
  full: '',
  soft: 'opacity-80',
  muted: 'opacity-55',
  faded: 'opacity-40',
} as const;

export const interactive: string =
  'cursor-pointer hover:border-text-ink motion-safe:hover:-translate-y-0.5 ' +
  'motion-safe:hover:scale-103 hover:z-1 hover:shadow-card ' +
  'active:translate-y-0 motion-safe:active:scale-98 active:shadow-word-card ' +
  'active:duration-75 active:ease-press';

/** The card a pick is on its way for: the primary border with the primary glow. */
export const selected: string =
  'z-1 border-(length:--stroke-heavy) border-primary ' +
  'shadow-[0_0_14px_var(--color-primary-light),0_3px_7px_var(--color-shadow-card)]';

export const revealing: string = 'motion-safe:animate-card-reveal';
