import { cn } from '@shared/utils';

import { AvatarImage } from './AvatarImage';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/** Ring color around the avatar. Teams reuse the board's team colors. */
export type AvatarRing = 'none' | 'primary' | 'teamA' | 'teamB' | 'muted';

export interface AvatarProps {
  /** Avatar image URL. Without one the placeholder face is drawn. */
  src?: string | undefined;
  /** Player name, used as the image's alternative text. */
  name: string;
  size?: AvatarSize;
  ring?: AvatarRing;
  /** Draws the online dot. Leave it out when presence is unknown. */
  online?: boolean | undefined;
  /** Replaces the preset size, for a design that draws the avatar at another size. */
  sizeClassName?: string;
  /** Replaces the preset online-dot size to match `sizeClassName`. */
  dotClassName?: string;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'h-10 w-10 text-lg',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-19 w-19 text-3xl',
  xl: 'h-21 w-21 text-4xl',
};

const dotStyles: Record<AvatarSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-5 w-5',
};

const ringStyles: Record<AvatarRing, string> = {
  none: '',
  primary: 'border-4 border-primary-sky',
  teamA: 'border-4 border-primary-sky',
  teamB: 'border-4 border-secondary-deep',
  muted: 'border-4 border-surface-sunken',
};

/**
 * Player avatar: the picture, its ring and the online dot in one element.
 *
 * The dot is decoration — presence is already stated in the surrounding text — so it
 * carries no label of its own.
 */
export function Avatar({
  src,
  name,
  size = 'md',
  ring = 'none',
  online,
  sizeClassName,
  dotClassName,
  className,
}: AvatarProps) {
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <span
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-pill bg-accent-yellow-deep',
          'transition-[border-color,scale] duration-200 ease-pop',
          'motion-safe:group-hover/row:scale-105',
          sizeClassName ?? sizeStyles[size],
          ringStyles[ring],
        )}
      >
        <AvatarImage
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          placeholderClassName="text-text-black"
        />
      </span>

      {online !== undefined && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-pill border-(length:--stroke-heavy) border-surface',
            'transition-colors duration-200 ease-out',
            online ? 'bg-success-soft' : 'bg-text-disabled',
            dotClassName ?? dotStyles[size],
          )}
        />
      )}
    </span>
  );
}
