import { useState } from 'react';

import { Icon } from '@shared/ui/Icon';

export interface AvatarImageProps {
  /** Avatar image URL. Without one, or once it fails to load, the placeholder face is drawn. */
  src: string | null | undefined;
  /** Alternative text. Empty by default, for a picture whose name is already beside it. */
  alt?: string;
  className?: string | undefined;
  placeholderClassName?: string | undefined;
}

/**
 * The picture inside an avatar frame. A URL that fails to load falls back to the
 * placeholder face, and a new URL gets its own chance to load. The frame — size, ring,
 * fill — belongs to the caller, so every screen draws its avatar as its design does.
 */
export function AvatarImage({ src, alt = '', className, placeholderClassName }: AvatarImageProps) {
  const [failed, setFailed] = useState<string | null>(null);

  return src && failed !== src ? (
    <img src={src} alt={alt} onError={() => setFailed(src)} className={className} />
  ) : (
    <Icon name="smile" {...(placeholderClassName ? { className: placeholderClassName } : {})} />
  );
}
