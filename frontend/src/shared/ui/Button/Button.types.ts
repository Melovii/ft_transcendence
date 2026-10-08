import type { ComponentProps } from 'react';

import type { IconName } from '@shared/ui/Icon';

/**
 * Emphasis, not color: `primary` is the one committing action on a screen, `neutral` the
 * safe choice beside a committing one, `muted` a low-emphasis action such as Pass,
 * `secondary` a committing action that costs the player something, such as leaving a room,
 * `success` a confirmed state, such as Ready, `danger` a destructive action and `cta` the
 * single large call to action.
 */
export type ButtonVariant =
  'primary' | 'neutral' | 'muted' | 'secondary' | 'success' | 'danger' | 'cta';

/**
 * `fill` is the solid button, `outline` the bordered one, `text` the label-only one and
 * `link` a label that underlines on hover, for a quiet action such as Change or Spectate.
 */
export type ButtonTheme = 'fill' | 'outline' | 'text' | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Replaces the preset size — height, padding, radius, gap and type — for a design that
   * draws the button at its own geometry. `className` still adds layout on top.
   */
  sizeClassName?: string;
  /** Marks the action as in flight: the button is inert and the label trails an ellipsis. */
  loading?: boolean;
  theme?: ButtonTheme;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label. */
  trailingIcon?: IconName;
  /** Stretches the button to its container's width. */
  block?: boolean;
}

/** An icon button carries no label of its own, so it needs an `aria-label`. */
export interface ButtonIconProps extends Omit<
  ButtonProps,
  'children' | 'icon' | 'trailingIcon' | 'block'
> {
  icon: IconName;
  'aria-label': string;
}
