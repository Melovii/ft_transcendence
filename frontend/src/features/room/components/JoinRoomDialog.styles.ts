/**
 * Class recipes for the Join Room dialog; the surface, header type, banner and actions are
 * shared with Create Room in `RoomEntryDialog.styles`.
 */

export const header: string = 'mt-[14px] h-auto w-full max-w-[403px] md:mt-[17px]';

// ---- Code field ----

export const form: string = 'mt-[16px] flex w-full flex-col md:mt-[18px]';

export const label: string = 'w-fit text-lg leading-[20px] font-bold text-text-ink';

export const control: string = 'relative mt-[8px] flex items-center';

export const keyIcon: string = 'pointer-events-none absolute left-[16px] text-2xl text-text-muted';

export const inputBase: string =
  'h-[58px] w-full min-w-0 rounded-[18px] border-2 bg-surface px-12 text-center text-4xl ' +
  'leading-none font-bold tracking-[4px] text-text-ink uppercase ' +
  'transition-[border-color,box-shadow] duration-200 ease-out ' +
  'placeholder:tracking-[4px] placeholder:text-text-disabled';

export const inputStatus = {
  default: 'border-border shadow-alert hover:border-primary-deep focus:border-primary-sky',
  error: 'border-secondary-dark shadow-input-error',
  success: 'border-success-soft shadow-alert',
};

export const fieldMessage: string = 'mt-[8px]';

// ---- Room preview ----

/** Holds the preview, the lookup loader or the result banner, at the preview's height. */
export const slot: string = 'mt-[20px] flex min-h-[118px] w-full flex-col items-center';

export const finding: string = 'flex flex-col items-center gap-[8px] pt-[6px]';

export const findingText: string = 'text-lg leading-[22px] font-bold text-text-muted';

export const preview: string =
  'relative w-[244px] rounded-[14px] border border-(length:--stroke-thin) border-border ' +
  'bg-surface shadow-card motion-safe:animate-rise-in';

/** The arrow that points the preview at the code field above it. */
export const previewPointer: string =
  'absolute -top-[7px] left-1/2 size-[12px] -translate-x-1/2 rotate-45 border-t border-l ' +
  'border-border bg-surface';

export const previewHead: string = 'flex items-center gap-[10px] p-[11px]';

export const previewTile: string =
  'inline-flex size-[50px] shrink-0 items-center justify-center rounded-[10px] ' +
  'bg-background text-[28px] text-primary-sky';

export const previewCode: string =
  'text-2xl leading-[24px] font-black tracking-[1px] text-text-ink';

export const previewCaption: string = 'text-md leading-[16px] font-regular text-text-faint';

export const previewFoot: string =
  'flex items-center justify-between gap-2 border-t border-(length:--stroke-thin) ' +
  'border-surface-sunken px-[13px] py-[10px]';

export const previewPlayers: string =
  'flex items-center gap-[7px] text-md leading-tight font-bold text-text-ink';

export const badgeBase: string =
  'inline-flex h-[24px] items-center rounded-pill px-[12px] text-sm leading-none font-black ' +
  'tracking-[0.3px] text-surface';

export const badgeTone = {
  JOINABLE: 'bg-accent-mint-deep',
  SEAT_OPEN: 'bg-primary',
  IN_PROGRESS: 'bg-primary',
  FULL: 'bg-secondary-deep',
  NOT_JOINABLE: 'bg-text-disabled',
};
