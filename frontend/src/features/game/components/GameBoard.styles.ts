/**
 * The board keeps five columns at every width, with the gaps of the three designed
 * layouts: 7px on a phone, 12px on a tablet, and 16×9px on the desktop board (the
 * 1920px design's 20×11px at the desktop's 80% scale).
 */

export const board: string =
  'grid w-full grid-cols-5 gap-[7px] md:gap-[12px] desktop:gap-x-[16px] desktop:gap-y-[9px]';

export const slot: string = 'min-w-0';
