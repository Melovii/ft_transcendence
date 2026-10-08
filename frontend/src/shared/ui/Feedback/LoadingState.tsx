import { cn } from '@shared/utils';

import { LoadingDots } from './LoadingDots';

export interface LoadingStateProps {
  /** What is being loaded, e.g. "Loading rooms…". */
  label: string;
  className?: string;
}

/**
 * The one way a feature says "this area is still loading". Every screen uses it, so
 * loading looks the same in the Lobby, the Room and the Game.
 */
export function LoadingState({ label, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-4 p-6', className)}
    >
      <LoadingDots label={label} />
      <p className="text-lg font-bold text-text-muted">{label}</p>
    </div>
  );
}
