import { cn } from '@shared/utils';

export type LoadingDotsSize = 'sm' | 'md' | 'lg';

export interface LoadingDotsProps {
  size?: LoadingDotsSize;
  /**
   * What is loading, announced to assistive technology. Without one the ring is
   * decorative and hidden from it, for a ring that sits beside its own visible text.
   */
  label?: string;
  className?: string;
}

/** The ring's eight dots, in the design system's order around the circle. */
const dotTones = [
  'bg-primary-bright',
  'bg-primary-soft',
  'bg-secondary-deep',
  'bg-accent-yellow',
  'bg-success-bright',
  'bg-accent-mint',
  'bg-primary-light',
  'bg-accent-red',
];

const ringStyles: Record<LoadingDotsSize, string> = {
  sm: 'h-11 w-11',
  md: 'h-17 w-17',
  lg: 'h-[84px] w-[84px]',
};

const dotStyles: Record<LoadingDotsSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-[15px] w-[15px]',
};

const radius: Record<LoadingDotsSize, number> = { sm: 18, md: 28, lg: 34.5 };

/**
 * The project's loading indicator: eight colored dots around a circle, each fading in
 * turn. Under `prefers-reduced-motion` the fade stops and the ring stays as a static
 * indicator, which the base stylesheet takes care of.
 */
export function LoadingDots({ size = 'md', label, className }: LoadingDotsProps) {
  return (
    <span
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
      className={cn('relative inline-block shrink-0', ringStyles[size], className)}
    >
      {dotTones.map((tone, index) => (
        <span
          key={tone}
          className={cn(
            'absolute top-1/2 left-1/2 rounded-pill motion-safe:animate-pulse',
            dotStyles[size],
            tone,
          )}
          style={{
            transform: `translate(-50%, -50%) rotate(${index * 45}deg) translateY(-${radius[size]}px)`,
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </span>
  );
}
