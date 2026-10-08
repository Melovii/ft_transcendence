import type { ButtonSize, ButtonTheme, ButtonVariant } from './Button.types';

/**
 * Class recipe for the button, matching the design system's button components and its
 * interaction state matrix.
 *
 * The base holds the layout and the interaction contract, `variant` owns fill, label
 * color and elevation, and the size owns geometry and type, so no two layers set the same
 * property. The size is a preset, or the caller's own `sizeClassName` for a button the
 * design draws at its own height, radius and type. Every value resolves to a design token
 * through the Tailwind theme.
 *
 * The layers never overlap because `cn()` only joins classes: when two utilities set the
 * same property, the stylesheet's order decides, not the order of the class list. A
 * caller's `className` therefore adds layout — width, margin, placement — and geometry
 * goes through `sizeClassName`, which replaces the preset instead of competing with it.
 *
 * The states follow the matrix. A soft-disabled button (`aria-disabled`), which keeps its
 * focus while it cannot act, answers neither hover nor press.
 *
 * Hover changes the fill, lifts the button by 2px and
 * grows its shadow by the same 2px, so the button rises from the page instead of
 * floating over a gap. Pressing drops it onto its own shadow, shrinks it a touch and
 * swaps the shadow for the pressed inset. Keyboard focus is the document-wide ring, so
 * focus and hover never look alike.
 *
 * Timing carries as much of the feel as the values do: the rise is slow enough to read
 * and overshoots slightly on `ease-pop`, while the press is immediate, because a control
 * that answers a click late reads as broken. The lift and the press are transforms, so
 * they are dropped under `prefers-reduced-motion` while the fill change stays.
 *
 * A button with no elevation of its own — the text theme, and an icon button that is not
 * filled — cannot be lifted off a shadow it does not have, so it answers with size and a
 * tint instead: it grows on hover and shrinks past its resting size when pressed, over
 * the same two durations, which reads as the same gesture in a flatter register.
 */
export const interaction: string =
  'cursor-pointer select-none ' +
  'transition-[translate,scale,box-shadow,background-color,border-color,color,opacity] ' +
  'duration-200 ease-pop ' +
  'not-disabled:not-aria-disabled:motion-safe:hover:-translate-y-0.5 ' +
  'not-disabled:not-aria-disabled:motion-safe:active:translate-y-1 ' +
  'not-disabled:not-aria-disabled:active:shadow-none ' +
  'not-disabled:active:duration-75 not-disabled:active:ease-press ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-default';

const flatInteraction: string =
  'cursor-pointer select-none ' +
  'transition-[scale,background-color,border-color,color,opacity] ' +
  'duration-100 ease-in ' +
  'not-disabled:not-aria-disabled:motion-safe:hover:scale-105 ' +
  'not-disabled:not-aria-disabled:motion-safe:active:scale-95 ' +
  'not-disabled:active:duration-75 not-disabled:active:ease-press ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-default';

const disabledFill: string =
  'disabled:bg-disabled disabled:text-text-muted disabled:shadow-button-disabled';

const disabledFlat: string = 'disabled:opacity-50';

/** A link-styled action answers with its underline, the way a link in running text does. */
const linkInteraction: string =
  'cursor-pointer rounded-sm underline-offset-2 transition-colors duration-200 ease-out ' +
  'not-disabled:not-aria-disabled:hover:underline disabled:cursor-not-allowed ' +
  'disabled:opacity-60 aria-disabled:cursor-default';

/** Layout every button shares. Geometry and type belong to the size, preset or custom. */
const box: string = 'group/button inline-flex items-center justify-center text-center';

export const baseStyles: Record<ButtonTheme, string> = {
  fill: `${box} ${interaction} ${disabledFill}`,
  outline: `${box} ${interaction} ${disabledFlat} border-(length:--stroke-default)`,
  text: `${box} ${flatInteraction} ${disabledFlat}`,
  link: `${box} ${linkInteraction}`,
};

/**
 * The preset sizes' radius and type. A button drawn at its own geometry (`sizeClassName`)
 * leaves all of it out, so its own values never compete with these in the cascade.
 */
const presetType: string = 'gap-2 tracking-tight leading-tight whitespace-nowrap';

export const presetStyles: Record<ButtonTheme, string> = {
  fill: `${presetType} rounded-md uppercase`,
  outline: `${presetType} rounded-lg uppercase`,
  text: `${presetType} rounded-md px-2 py-1`,
  link: presetType,
};

export const variantStyles: Record<ButtonTheme, Record<ButtonVariant, string>> = {
  fill: {
    primary:
      'bg-primary text-surface shadow-button-primary ' +
      'not-disabled:not-aria-disabled:hover:bg-primary-bright not-disabled:not-aria-disabled:hover:shadow-button-primary-hover',
    neutral:
      'bg-background text-text-black shadow-button-neutral ' +
      'not-disabled:not-aria-disabled:hover:bg-surface-raised not-disabled:not-aria-disabled:hover:shadow-button-neutral-hover',
    muted:
      'bg-surface-muted text-text-muted shadow-button-muted ' +
      'not-disabled:not-aria-disabled:hover:bg-surface-sunken not-disabled:not-aria-disabled:hover:shadow-button-muted-hover',
    secondary:
      'bg-secondary-deep text-surface shadow-button-coral ' +
      'not-disabled:not-aria-disabled:hover:brightness-105 ' +
      'not-disabled:not-aria-disabled:hover:shadow-button-coral-hover',
    success:
      'bg-success-deep text-surface shadow-button-success-deep ' +
      'not-disabled:not-aria-disabled:hover:brightness-105',
    danger:
      'bg-destructive text-surface shadow-button-destructive ' +
      'not-disabled:not-aria-disabled:hover:bg-accent-red ' +
      'not-disabled:not-aria-disabled:hover:shadow-button-destructive-hover',
    cta:
      'bg-cta text-text-ink shadow-button-cta ' +
      'not-disabled:not-aria-disabled:hover:bg-accent-yellow not-disabled:not-aria-disabled:hover:shadow-button-cta-hover',
  },
  outline: {
    primary:
      'border-primary-deep text-primary-sky not-disabled:not-aria-disabled:hover:bg-primary/10',
    neutral: 'border-border text-text-black not-disabled:not-aria-disabled:hover:bg-surface-muted',
    muted: 'border-border text-text-muted not-disabled:not-aria-disabled:hover:bg-surface-muted',
    // The coral outline usually sits raised on a white fill of its own, so its hover tint is
    // mixed against white rather than laid over whatever is behind the button.
    secondary:
      'border-secondary-dark text-accent-red ' +
      'not-disabled:not-aria-disabled:hover:bg-[color-mix(in_srgb,var(--color-secondary-dark)_5%,var(--color-surface))]',
    success:
      'border-success-deep text-success-deep not-disabled:not-aria-disabled:hover:bg-success/10',
    danger:
      'border-destructive text-destructive not-disabled:not-aria-disabled:hover:bg-destructive/10',
    cta: 'border-cta text-text-ink not-disabled:not-aria-disabled:hover:bg-cta/20',
  },
  text: {
    primary:
      'text-primary-sky not-disabled:not-aria-disabled:hover:bg-primary/10 not-disabled:not-aria-disabled:hover:text-primary',
    neutral:
      'text-text-black not-disabled:not-aria-disabled:hover:bg-surface-muted not-disabled:not-aria-disabled:hover:text-text-ink',
    muted:
      'text-text-muted not-disabled:not-aria-disabled:hover:bg-surface-muted not-disabled:not-aria-disabled:hover:text-text',
    secondary: 'text-accent-red not-disabled:not-aria-disabled:hover:bg-secondary-dark/10',
    success: 'text-success-deep not-disabled:not-aria-disabled:hover:bg-success/10',
    danger:
      'text-destructive not-disabled:not-aria-disabled:hover:bg-destructive/10 not-disabled:not-aria-disabled:hover:text-accent-red',
    cta: 'text-text-ink not-disabled:not-aria-disabled:hover:bg-cta/20 not-disabled:not-aria-disabled:hover:text-accent-yellow-deep',
  },
  link: {
    primary: 'text-primary-sky',
    neutral: 'text-text-black',
    muted: 'text-text-muted',
    secondary: 'text-accent-red',
    success: 'text-success-deep',
    danger: 'text-destructive',
    cta: 'text-text-ink',
  },
};

export const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-lg font-bold',
  md: 'h-10 px-4 text-xl font-bold',
  lg: 'h-13 px-5 text-2xl font-bold',
  xl: 'h-17 px-6 text-4xl font-black',
};

/** The text theme is a label, so it keeps the type size without the button box. */
export const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-md font-bold',
  md: 'text-lg font-bold',
  lg: 'text-xl font-bold',
  xl: 'text-2xl font-bold',
};

/** Icon buttons are circles, sized so the touch target stays comfortable. */
export const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 text-lg',
  md: 'h-11 w-11 text-xl',
  lg: 'h-14 w-14 text-2xl',
  xl: 'h-16 w-16 text-3xl',
};

const iconBox: string = 'inline-flex shrink-0 items-center justify-center rounded-pill';

export const iconBaseStyles: Record<ButtonTheme, string> = {
  fill: `${iconBox} ${interaction} ${disabledFill} not-disabled:not-aria-disabled:motion-safe:hover:scale-105`,
  outline: `${iconBox} ${flatInteraction} ${disabledFlat} border-(length:--stroke-default)`,
  text: `${iconBox} ${flatInteraction} ${disabledFlat}`,
  link: `${iconBox} ${linkInteraction}`,
};

/**
 * Icons inside a button answer the hover as well: the leading glyph grows a little and
 * the trailing one slides toward the direction it points, which reads as the button
 * leaning into the pointer.
 *
 * Only one element in a button ever scales. A flat button scales its own box, so the
 * glyph inside it holds still — two scales on the same hover multiply into a jump, and
 * the glyph would then fight the box on the press, where the two shrink by different
 * amounts. `Button` therefore drops the leading-icon growth on the text theme, and an
 * icon button, whose glyph is its whole label, scales the box alone.
 */
export const leadingIconStyles: string =
  'transition-transform duration-200 ease-pop motion-safe:group-hover/button:scale-110';

export const trailingIconStyles: string =
  'transition-transform duration-200 ease-pop motion-safe:group-hover/button:translate-x-1';
