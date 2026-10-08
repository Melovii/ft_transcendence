/**
 * Class recipes for the Create Room dialog; the surface, header type, banner and actions
 * are shared with Join Room in `RoomEntryDialog.styles`.
 */

export const mascot: string =
  'mt-[22px] h-[106px] w-[140px] md:mt-[30px] md:h-[126px] md:w-[166px]';

// ---- Benefits ----

export const benefits: string = 'mt-[18px] flex flex-col gap-[9px] self-center md:mt-[20px]';

export const benefit: string =
  'flex items-center gap-[11px] text-lg leading-[20px] font-medium text-text-ink';

export const benefitTileBase: string =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-lg text-surface';

export const benefitTile = {
  primary: 'bg-primary-sky',
  success: 'bg-success',
  coral: 'bg-secondary-deep',
};

// ---- Form ----

export const form: string = 'mt-[20px] flex w-full flex-col gap-[20px] md:mt-[24px]';

export const capacity: string = 'flex items-center justify-between gap-3';

export const capacityLabel: string =
  'flex items-baseline gap-2 text-lg leading-[20px] font-regular text-text-ink';

export const capacityHint: string = 'text-sm leading-[16px] font-regular text-text-muted';

export const stepper: string =
  'flex h-9 shrink-0 items-stretch overflow-hidden rounded-[18px] border ' +
  'border-(length:--stroke-thin) border-border bg-surface-raised';

export const stepperButton: string =
  'inline-flex w-9 cursor-pointer items-center justify-center text-md text-text ' +
  'transition-colors duration-100 not-disabled:hover:bg-surface-muted ' +
  'disabled:cursor-not-allowed disabled:text-text-disabled';

export const stepperValue: string =
  'inline-flex w-[56px] items-center justify-center border-x ' +
  'border-border bg-surface text-md leading-tight font-bold text-text';
