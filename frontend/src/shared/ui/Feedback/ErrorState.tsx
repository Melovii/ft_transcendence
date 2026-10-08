import { cn } from '@shared/utils';
import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

interface ErrorStateBase {
  /** What failed, in the user's terms. */
  title: string;
  /** What the user can do about it. */
  description?: string;
  className?: string;
}

/** Retry is optional; when it is offered, its translated label comes with it. */
export type ErrorStateProps = ErrorStateBase &
  ({ onRetry: () => void; retryLabel: string } | { onRetry?: undefined; retryLabel?: undefined });

/**
 * The one way a feature reports a failed load. It is an assertive live region, because
 * the user's action did not complete and they need to know now.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-3 p-6 text-center', className)}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-error text-3xl text-surface">
        <Icon name="warning" />
      </span>
      <p className="text-xl font-black">{title}</p>
      {description && <p className="text-md text-text-muted">{description}</p>}
      {onRetry && (
        <Button variant="neutral" icon="history" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
