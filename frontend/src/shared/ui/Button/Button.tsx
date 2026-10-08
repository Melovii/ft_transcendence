import { cn } from '@shared/utils';
import { Icon } from '@shared/ui/Icon';

import {
  baseStyles,
  leadingIconStyles,
  presetStyles,
  sizeStyles,
  textSizeStyles,
  trailingIconStyles,
  variantStyles,
} from './Button.styles';
import type { ButtonProps } from './Button.types';

/**
 * The application's button.
 *
 * A loading button keeps its fill and its label and trails an ellipsis, as the design
 * system's loading state does. It stops responding to clicks while the action is in
 * flight, but it is not disabled: it keeps its place in the tab order and reports
 * itself as busy, so the label never turns into something the user did not click.
 *
 * A preset size truncates a label that does not fit. A button drawn at its own geometry
 * lays its children out directly, so marks and glyphs passed with the label sit on the
 * button's own gap.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  sizeClassName,
  loading = false,
  className,
  disabled,
  type = 'button',
  theme = 'fill',
  icon,
  trailingIcon,
  block = false,
  ...props
}: ButtonProps) {
  const preset = sizeClassName === undefined;
  // A label-only button has no box to size, so it keeps the type size alone.
  const flat = theme === 'text' || theme === 'link';
  const ellipsis = loading && <span className="motion-safe:animate-pulse">…</span>;

  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cn(
        baseStyles[theme],
        variantStyles[theme][variant],
        preset
          ? cn(presetStyles[theme], flat ? textSizeStyles[size] : sizeStyles[size])
          : sizeClassName,
        block && 'w-full',
        loading && 'pointer-events-none',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} {...(flat ? {} : { className: leadingIconStyles })} />}
      {preset ? (
        <span className="min-w-0 truncate">
          {children}
          {ellipsis}
        </span>
      ) : (
        <>
          {children}
          {ellipsis}
        </>
      )}
      {trailingIcon && <Icon name={trailingIcon} className={disabled ? '' : trailingIconStyles} />}
    </button>
  );
}
