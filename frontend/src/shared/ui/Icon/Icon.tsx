import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import './fontAwesomeConfig';

import { cn } from '@shared/utils';

import { ICONS } from './icons';
import type { IconProps } from './Icon.types';

/**
 * The single icon component. It renders an SVG that inherits the surrounding font size
 * and color, so `text-lg` and `text-primary` on the icon or its parent size and color it
 * like any other text.
 */
export function Icon({ name, label, className, spin = false }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={ICONS[name]}
      spin={spin}
      className={cn('inline-block h-[1em] w-[1em] align-[-0.125em]', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
