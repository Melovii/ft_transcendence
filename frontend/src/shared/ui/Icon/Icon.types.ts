import type { IconName } from './icons';

export interface IconProps {
  /** Name from the project icon set. */
  name: IconName;
  /**
   * Label for assistive technology. Leave it out when the icon only repeats adjacent
   * text; the icon is then hidden from the accessibility tree.
   */
  label?: string;
  /** Extra utility classes. The icon inherits font size and color by default. */
  className?: string;
  /** Spins the icon, for a pending or reconnecting state. */
  spin?: boolean;
}
