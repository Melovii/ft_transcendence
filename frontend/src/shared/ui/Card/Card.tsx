import type { HTMLAttributes } from 'react';

import { cn } from '@shared/utils';

export type CardTone = 'surface' | 'raised' | 'muted';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  /** Removes the default padding, for a card that owns its own inner layout. */
  flush?: boolean;
  /**
   * Marks the card as a target the user can act on: it lifts on hover and settles back
   * when pressed. Give the card a real control — a button or a link — as well.
   */
  interactive?: boolean;
}

const toneStyles: Record<CardTone, string> = {
  surface: 'bg-surface',
  raised: 'bg-surface-raised',
  muted: 'bg-surface-muted',
};

/** Elevated surface that groups related content. */
export function Card({
  tone = 'surface',
  flush = false,
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg shadow-card',
        'transition-[transform,scale,box-shadow,border-color] duration-200 ease-pop',
        toneStyles[tone],
        !flush && 'p-4',
        interactive &&
          'cursor-pointer hover:shadow-panel motion-safe:hover:-translate-y-1 ' +
            'active:translate-y-0 active:shadow-soft motion-safe:active:scale-98 ' +
            'active:duration-75 active:ease-press',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
