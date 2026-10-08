import type { ReactNode } from 'react';

import { cn } from '@shared/utils';
import { Icon, type IconName } from '@shared/ui/Icon';

export type AlertTone = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  tone: AlertTone;
  /** Short headline. The body explains what to do next. */
  title: string;
  children?: ReactNode;
  className?: string;
}

const toneStyles: Record<AlertTone, string> = {
  success: 'bg-success-deep text-surface',
  error: 'bg-secondary-deep text-surface',
  warning: 'bg-accent-yellow text-text-black',
  info: 'bg-primary text-surface',
};

const toneIcons: Record<AlertTone, IconName> = {
  success: 'check',
  error: 'warning',
  warning: 'warning',
  info: 'hint',
};

/**
 * Page-level result of an action. An error is announced assertively; the other tones are
 * polite, so a success notice never cuts across what the user is reading.
 */
export function Alert({ tone, title, children, className }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-3 py-2 shadow-alert',
        'motion-safe:animate-rise-in',
        toneStyles[tone],
        className,
      )}
    >
      <Icon name={toneIcons[tone]} className="mt-2 shrink-0 text-lg" />
      <div className="min-w-0">
        <p className="text-md font-bold tracking-tight">{title}</p>
        {children && <p className="text-md">{children}</p>}
      </div>
    </div>
  );
}
