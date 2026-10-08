import type { ReactNode } from 'react';

import { cn } from '@shared/utils';
import { ButtonIcon } from '@shared/ui/Button';
import { Icon, type IconName } from '@shared/ui/Icon';

export type ToastTone = 'neutral' | 'success' | 'error';

interface ToastBase {
  /** The message. Short enough to read in the few seconds the toast is up. */
  children: ReactNode;
  tone?: ToastTone;
  icon?: IconName | undefined;
  className?: string;
}

/**
 * Present when the toast can be dismissed by hand, together with the translated name of
 * its dismiss button.
 */
export type ToastProps = ToastBase &
  (
    | { onDismiss: () => void; dismissLabel: string }
    | { onDismiss?: undefined; dismissLabel?: undefined }
  );

const toneStyles: Record<ToastTone, string> = {
  neutral: 'bg-surface text-text-black',
  success: 'bg-success-deep text-surface',
  error: 'bg-secondary-deep text-surface',
};

/**
 * One transient notice. It is a polite live region, so assistive technology announces it
 * without interrupting whatever the user is doing, and it rises into place so a second
 * toast is visibly a new one.
 */
export function Toast({
  children,
  tone = 'neutral',
  icon,
  onDismiss,
  dismissLabel,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex max-w-sm items-center gap-2 rounded-md py-2 pl-3 shadow-toast',
        'motion-safe:animate-rise-in',
        toneStyles[tone],
        onDismiss ? 'pr-1' : 'pr-3',
        className,
      )}
    >
      {icon && <Icon name={icon} className="text-lg" />}
      <span className="min-w-0 text-md font-bold">{children}</span>
      {onDismiss && (
        <ButtonIcon
          icon="close"
          theme="text"
          variant={tone === 'neutral' ? 'muted' : 'neutral'}
          size="sm"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(tone !== 'neutral' && 'text-surface')}
        />
      )}
    </div>
  );
}

/** Fixed stack the app mounts once; toasts render into it, newest at the bottom. */
export function ToastStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-(--z-toast) flex flex-col items-center gap-2 px-3">
      {children}
    </div>
  );
}
