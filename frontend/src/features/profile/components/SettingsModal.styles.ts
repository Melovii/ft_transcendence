/**
 * Class recipes for Settings and its two pop-ups, Crop Photo and Pick Avatar.
 *
 * Phones are the base: the design's 358px mobile card at full size. From `md:` each card is
 * the desktop design at 80% — Settings 608px wide, Crop Photo and Pick Avatar 448px — the
 * scale the Profile pop-up uses, so they stay compact cards over the page on tablets as
 * well. Crop Photo and Pick Avatar have no phone design; they take the Settings card's
 * phone width and padding. The shared `Dialog` shell draws the backdrop and the close
 * button in the top-right corner.
 */

// ---- Cards ----

const cardBase: string =
  'max-w-[358px] rounded-[35px] bg-surface px-[20px] py-[24px] shadow-auth-dialog ' +
  'md:rounded-[28px]';

export const settingsCard: string = `${cardBase} gap-[12px] md:max-w-[608px] md:gap-[19px] md:px-[32px] md:py-[29px]`;

export const cropCard: string =
  `${cardBase} items-center gap-[16px] md:max-w-[448px] md:gap-[16px] md:px-[32px] ` +
  'md:py-[26px]';

export const pickCard: string = `${cardBase} gap-[19px] md:max-w-[448px] md:px-[32px] md:py-[26px]`;

// ---- Header ----

/** Clear of the close button, which sits over the header's top-right corner. */
export const header: string = 'flex w-full flex-col gap-[4px] pr-[48px] md:gap-[3px]';

export const title: string =
  'text-3xl leading-[1.3] font-black text-text-ink normal-case md:text-[26px]';

export const subtitle: string = 'text-md leading-[1.5] font-regular text-text-muted';

// ---- Sections ----

export const section: string = 'flex flex-col gap-[10px] md:gap-[8px]';

export const label: string =
  'text-md leading-[22px] font-black tracking-[1px] text-text-slate uppercase ' +
  'md:text-xs md:leading-[18px] md:tracking-[0.8px]';

export const hint: string =
  'text-md leading-[22px] font-regular text-text-muted md:text-sm md:leading-[18px]';

/** The design's Field Message: the red badge and the line beside it. */
export const fieldError: string =
  'items-start gap-[8px] text-lg leading-[1.2] font-regular md:text-[18px]';

// ---- Profile picture ----

export const avatarRow: string = 'flex items-center gap-[16px] md:gap-[19px]';

export const currentAvatar: string =
  'flex size-[80px] shrink-0 items-center justify-center overflow-hidden rounded-pill ' +
  'bg-accent-yellow-deep md:size-[83px]';

export const avatarImage: string = 'h-full w-full object-cover';

export const avatarPlaceholder: string = 'text-[40px] text-text md:text-[42px]';

export const avatarActions: string = 'flex min-w-0 flex-1 flex-col gap-[8px] md:gap-[6px]';

export const avatarButtons: string = 'flex flex-col gap-[8px] md:flex-row md:gap-[10px]';

/** The design system's Outline Blue secondary button. */
/** Geometry of the outline blue buttons beside the avatar; the shared `Button` draws them. */
export const outlineButton: string =
  'h-[48px] rounded-[20px] px-[12px] text-xl leading-none font-bold tracking-[-1.5px] ' +
  'whitespace-nowrap uppercase md:h-[42px] md:rounded-[16px] md:text-[16px] ' +
  'md:tracking-[-1.2px]';

export const outlineButtonWidth: string = 'w-full bg-surface md:w-[176px]';

// ---- Username ----

export const usernameForm: string = 'flex items-start gap-[12px] md:gap-[10px]';

export const inputWrap: string = 'relative flex min-w-0 flex-1 items-center';

export const inputIcon: string =
  'pointer-events-none absolute left-[14px] text-xl text-text-slate md:left-[11px] ' +
  'md:text-[16px]';

export const input: string =
  'h-[52px] w-full min-w-0 rounded-[20px] border-(length:--stroke-thin) bg-surface ' +
  'pr-[14px] pl-[46px] text-xl font-bold text-text-ink shadow-alert ' +
  'transition-[border-color,background-color,box-shadow] duration-200 ease-out ' +
  'placeholder:text-text-placeholder disabled:bg-disabled disabled:text-text-disabled ' +
  'md:h-[45px] md:rounded-[16px] md:pl-[36px] md:text-[16px]';

export const inputStatus = {
  default:
    'border-border enabled:hover:border-primary-deep focus:border-primary ' +
    'focus:bg-surface-raised focus:shadow-soft',
  error: 'border-secondary-dark focus:border-error focus:shadow-soft',
};

export const saveButton: string =
  'h-[52px] w-[92px] rounded-[20px] text-2xl leading-none font-bold md:h-[45px] ' +
  'md:w-[120px] md:rounded-[16px] md:text-[18px]';

/** The read-only email: muted, and no hover or focus change beyond the focus ring. */
export const inputReadOnly: string = 'border-border bg-surface-muted text-text-slate';

// ---- Language ----

export const language: string = 'self-start';

// ---- Account ----

export const divider: string = 'h-[2px] w-full shrink-0 rounded-pill bg-surface-sunken';

export const logOut: string =
  'h-[52px] gap-[8px] rounded-md text-[25px] leading-none font-bold md:h-[42px] ' +
  'md:rounded-[11px] md:text-[20px]';

/** An outline button that sits raised on the white card, like Leave Room. */
export const raisedSurface: string =
  'bg-surface shadow-button-muted not-disabled:not-aria-disabled:hover:shadow-button-muted-hover';

export const deleteAccount: string =
  'gap-[8px] text-md leading-[22px] font-bold md:text-sm md:leading-[18px]';

export const logOutError: string =
  'text-center text-md leading-[1.3] font-bold text-accent-red md:text-sm';

export const legal: string =
  'flex flex-wrap items-center justify-center gap-x-[14px] gap-y-[4px] text-md ' +
  'leading-[22px] font-bold text-primary-deep md:text-sm md:leading-[18px]';

export const legalLink: string = 'rounded-sm underline-offset-2 hover:text-primary hover:underline';

// ---- Crop Photo ----

export const cropViewport: string =
  'relative size-[256px] shrink-0 cursor-grab touch-none overflow-hidden rounded-[16px] ' +
  'bg-surface-sunken select-none active:cursor-grabbing';

export const cropImage: string = 'pointer-events-none absolute max-w-none';

/** The round guide shows what the avatar keeps; the corners are cut in every avatar. */
export const cropGuide: string =
  'pointer-events-none absolute inset-[3.125%] rounded-pill border-3 border-surface';

export const zoomRow: string = 'flex w-[256px] items-center gap-[10px]';

export const zoomIcon: string = 'shrink-0 text-[19px] text-text-muted';

/** The design system's progress bar, drawn as a range input so it works by keyboard. */
export const zoomSlider: string =
  'h-[22px] min-w-0 flex-1 cursor-pointer appearance-none bg-transparent ' +
  '[&::-webkit-slider-runnable-track]:h-[14px] ' +
  '[&::-webkit-slider-runnable-track]:rounded-pill ' +
  '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--fill),var(--color-surface-sunken)_var(--fill))] ' +
  '[&::-webkit-slider-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:size-[22px] ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill ' +
  '[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-avatar ' +
  '[&::-moz-range-track]:h-[14px] [&::-moz-range-track]:rounded-pill ' +
  '[&::-moz-range-track]:bg-surface-sunken [&::-moz-range-progress]:h-[14px] ' +
  '[&::-moz-range-progress]:rounded-pill [&::-moz-range-progress]:bg-primary ' +
  '[&::-moz-range-thumb]:size-[22px] [&::-moz-range-thumb]:rounded-pill ' +
  '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary';

export const previewRow: string = 'flex items-center gap-[11px]';

export const preview: string =
  'relative size-[58px] shrink-0 overflow-hidden rounded-pill bg-surface-sunken';

export const previewLabel: string = 'max-w-[224px] text-sm leading-[1.4] font-bold text-text-slate';

export const cropHint: string = `${hint} text-center`;

export const hintAction: string =
  'rounded-sm font-bold text-primary-sky underline underline-offset-2 hover:text-primary';

export const actions: string = 'grid w-full grid-cols-2 gap-[13px]';

/** Cancel and Save under the picker and the cropper: outline and primary. */
export const actionOutline: string =
  'h-[48px] rounded-[16px] text-[16px] leading-none font-bold tracking-[-1.2px] uppercase ' +
  'md:h-[45px]';

export const actionPrimary: string =
  'h-[48px] rounded-[11px] text-[16px] leading-none font-bold tracking-[-1.2px] uppercase ' +
  'md:h-[45px]';

// ---- Pick Avatar ----

export const grid: string =
  'flex flex-wrap justify-center gap-x-[12px] gap-y-[14px] md:gap-x-[19px] md:gap-y-[16px]';

export const tile: string =
  'relative size-[64px] shrink-0 cursor-pointer rounded-pill transition-[scale] ' +
  'duration-100 ease-in motion-safe:hover:scale-105 motion-safe:active:scale-95 ' +
  'md:size-[77px]';

export const tileImage: string =
  'h-full w-full rounded-pill border-(length:--stroke-medium) border-border ' +
  'bg-surface-muted object-cover';

export const tileImageSelected: string = 'border-(length:--stroke-heavy) border-primary';

export const tileCheck: string =
  'absolute right-0 bottom-0 flex size-[22px] items-center justify-center rounded-pill ' +
  'border-2 border-surface bg-primary text-[11px] text-surface md:size-[24px] ' +
  'md:text-[12px]';

export const tileSkeleton: string = 'size-[64px] rounded-pill md:size-[77px]';

export const pickNotice: string = 'flex flex-col items-center gap-[10px] py-[16px] text-center';
