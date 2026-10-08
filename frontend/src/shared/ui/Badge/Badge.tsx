import type { ReactNode } from 'react';

import { cn } from '@shared/utils';
import { Icon, type IconName } from '@shared/ui/Icon';

export type BadgeVariant = 'neutral' | 'host' | 'ready' | 'role' | 'danger' | 'warning' | 'success';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: IconName;
  /** Draws the icon in the filled circle the design system uses for a Ready badge. */
  circleIcon?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-muted text-text-ink',
  host: 'bg-primary-sky text-surface',
  ready: 'bg-success-deep text-surface',
  role: 'bg-primary-muted text-surface',
  danger: 'bg-destructive text-surface',
  warning: 'bg-accent-yellow text-text-black',
  success: 'bg-success text-surface',
};

/** Circle colors invert the badge: the fill becomes the glyph's color. */
const circleStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-text-ink text-surface-muted',
  host: 'bg-surface text-primary-sky',
  ready: 'bg-surface text-success-deep',
  role: 'bg-surface text-primary-muted',
  danger: 'bg-surface text-destructive',
  warning: 'bg-text-black text-accent-yellow',
  success: 'bg-surface text-success',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'h-6 gap-1 px-2 text-sm',
  md: 'h-8 gap-1.5 px-3 text-lg',
  lg: 'h-11 gap-2 px-4 text-xl',
};

const circleSizeStyles: Record<BadgeSize, string> = {
  sm: 'h-4 w-4 text-xs',
  md: 'h-5 w-5 text-sm',
  lg: 'h-6 w-6 text-md',
};

/** Short status pill: HOST, READY, a player role, a warning. */
export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  circleIcon = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill font-black uppercase leading-tight',
        'transition-colors duration-200 ease-out',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {icon &&
        (circleIcon ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-pill',
              'transition-colors duration-200 ease-out',
              circleSizeStyles[size],
              circleStyles[variant],
            )}
          >
            <Icon name={icon} />
          </span>
        ) : (
          <Icon name={icon} />
        ))}
      {children}
    </span>
  );
}
