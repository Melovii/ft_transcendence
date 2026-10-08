import { cn } from '@shared/utils';
import { Icon } from '@shared/ui/Icon';

import { messageBadgeStyles, messageStyles } from './Input.styles';
import type { InputStatus } from './Input.types';

export interface FieldMessageProps {
  id: string;
  status: InputStatus;
  children: React.ReactNode;
  className?: string;
}

/**
 * The line under a field. A validated outcome is drawn with the round badge the design
 * system uses, and an error is announced, since the user cannot be assumed to be
 * looking at the field they just left.
 */
export function FieldMessage({ id, status, children, className }: FieldMessageProps) {
  const validated = status !== 'default';

  return (
    <p
      id={id}
      role={status === 'error' ? 'alert' : undefined}
      className={cn('flex items-center gap-2 text-sm', messageStyles[status], className)}
    >
      {validated && (
        <span
          className={cn(
            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-pill text-xs',
            messageBadgeStyles[status],
          )}
        >
          <Icon name={status === 'error' ? 'warning' : 'check'} />
        </span>
      )}
      {children}
    </p>
  );
}
