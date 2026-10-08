import type { InputSize, InputStatus } from './Input.types';

/**
 * Class recipe for the fields, matching the design system's input components.
 *
 * The control owns its fill and border; the keyboard focus ring comes from the
 * document-level `:focus-visible` rule, so focus looks the same on every control. The
 * hover and focus borders only change color, which keeps the field from shifting by a
 * pixel as the stroke changes.
 */
export const controlBase: string =
  'w-full min-w-0 bg-surface text-text placeholder:text-text-placeholder ' +
  'border-(length:--stroke-default) shadow-alert ' +
  'transition-[border-color,background-color,box-shadow] duration-200 ease-out ' +
  'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-disabled ' +
  'disabled:placeholder:text-text-disabled disabled:shadow-none';

export const statusStyles: Record<InputStatus, string> = {
  default:
    'border-border enabled:hover:border-primary-deep enabled:hover:shadow-soft ' +
    'focus:border-primary focus:bg-surface-raised focus:shadow-soft',
  error: 'border-secondary-dark focus:border-error focus:shadow-soft',
  success: 'border-success-soft focus:border-success focus:shadow-soft',
};

export const sizeStyles: Record<InputSize, string> = {
  md: 'h-9 rounded-pill px-3 text-md',
  lg: 'h-17 rounded-md px-4 text-center text-4xl font-black tracking-tight',
};

/** Inline padding that keeps the value clear of an icon drawn over the control. */
export const iconPadding = {
  leading: 'pl-9',
  trailing: 'pr-9',
};

export const messageStyles: Record<InputStatus, string> = {
  default: 'text-text-muted',
  error: 'text-accent-red',
  success: 'text-success-deep',
};

export const messageBadgeStyles: Record<InputStatus, string> = {
  default: '',
  error: 'bg-error text-surface',
  success: 'bg-success text-surface',
};
