import { buttonInteraction } from '@shared/ui';

/**
 * Clue panel recipes. Desktop values are the 1920px design's at 80%: the Give a Clue
 * panel is 853×78 with a 512px clue field, a 116px number stepper and a 178px Give Clue
 * button; the Operative panel is 853×102 with the clue centred and Pass on the right.
 * Phones and tablets stack the panel: instruction, fields, then a full-width button.
 */

const panel: string =
  'relative w-full rounded-lg bg-surface shadow-[0_4px_8px_var(--color-shadow-warm)] ' +
  'desktop:rounded-[16px] desktop:shadow-[0_5px_8px_var(--color-shadow-warm)]';

// ---- Give a Clue form ----

export const form: string =
  `${panel} flex flex-col gap-[6px] px-[12px] py-[10px] desktop:rounded-[14px] ` +
  'desktop:pt-[11px] desktop:pb-[10px]';

export const formGrid: string =
  'grid grid-cols-[minmax(0,1fr)_110px] gap-[8px] ' +
  "[grid-template-areas:'hint_hint'_'input_number'_'submit_submit'] " +
  'desktop:grid-cols-[512px_116px_178px] desktop:gap-x-[12px] desktop:gap-y-[7px] ' +
  "desktop:[grid-template-areas:'labels_numlabel_submit'_'input_number_submit']";

export const formHint: string =
  'text-center text-md leading-[22px] font-bold text-text-muted [grid-area:hint] desktop:hidden';

export const formLabels: string =
  'sr-only desktop:not-sr-only desktop:flex desktop:items-baseline desktop:[grid-area:labels]';

export const label: string = 'text-[16px] leading-none font-bold text-text-ink';

export const numberLabel: string = 'sr-only desktop:not-sr-only desktop:[grid-area:numlabel]';

export const formHeading: string =
  'ml-auto mr-[64px] text-[18px] leading-none font-black text-text-ink uppercase';

export const clueInput: string =
  'h-[42px] w-full min-w-0 rounded-pill border-(length:--stroke-thin) border-border ' +
  'bg-surface-raised px-[16px] text-lg font-bold text-text-ink uppercase outline-none ' +
  'placeholder:font-regular placeholder:normal-case placeholder:text-text-placeholder ' +
  'focus-visible:border-primary aria-invalid:border-secondary-dark read-only:text-text-muted ' +
  '[grid-area:input] desktop:h-[34px] desktop:px-[13px] desktop:text-[18px]';

export const stepper = {
  default:
    'grid h-[42px] grid-cols-[1fr_1.4fr_1fr] items-stretch overflow-hidden rounded-pill ' +
    'border-(length:--stroke-thin) border-border bg-surface-raised text-text-ink ' +
    '[grid-area:number] desktop:h-[34px]',
  sent:
    'grid h-[34px] grid-cols-[1fr_1.4fr_1fr] items-stretch overflow-hidden rounded-pill ' +
    'bg-surface-sunken text-text-muted [grid-area:number]',
} as const;

export const stepperButton: string =
  'inline-flex cursor-pointer items-center justify-center text-md transition-colors ' +
  'duration-100 not-disabled:hover:bg-surface-muted disabled:cursor-default disabled:opacity-40';

export const stepperValue: string =
  'flex items-center justify-center border-x-(length:--stroke-thin) border-border ' +
  'bg-surface text-xl font-bold text-text-ink desktop:text-[19px]';

/** Give Clue: the shared primary `Button` at the panel's geometry. */
export const submit: string =
  'h-[46px] gap-[10px] rounded-lg text-xl leading-none font-bold desktop:h-[56px] ' +
  'desktop:rounded-[14px] desktop:text-[24px]';

export const submitPlacement: string =
  'aria-busy:cursor-progress [grid-area:submit] desktop:self-start';

export const submitIcon: string = 'hidden text-[0.8em] desktop:inline';

export const rule: string = 'text-sm leading-[18px] font-bold text-secondary-dark desktop:text-md';

export const feedback: string =
  'text-sm leading-[18px] font-bold text-secondary-dark desktop:text-md';

export const formFeedback: string = '';

// ---- Clue Sent ----

export const sent: string = 'w-full';

export const sentWide: string =
  'hidden w-full grid-cols-[512px_116px_1fr] gap-x-[12px] gap-y-[7px] rounded-[14px] ' +
  'bg-linear-to-b from-primary-sky to-primary-deep px-[12px] pt-[11px] pb-[10px] ' +
  'shadow-[0_5px_7px_var(--color-shadow-warm)] desktop:grid ' +
  "[grid-template-areas:'labels_numlabel_status'_'input_number_status']";

export const sentLabels: string = 'flex [grid-area:labels]';

export const sentLabel: string = 'text-[16px] leading-none font-bold text-surface uppercase';

export const sentValue: string =
  'flex h-[34px] items-center rounded-pill bg-surface-sunken px-[13px] text-[18px] ' +
  'leading-none font-bold text-text-ink [grid-area:input]';

export const sentStatus: string =
  'flex flex-col items-center justify-center gap-[6px] [grid-area:status]';

export const sentTitle: string =
  'flex items-center gap-[6px] text-[22px] leading-none font-bold text-surface';

export const sentCheck: string = 'text-[20px] text-surface-raised';

export const sentGuesses: string = 'text-[16px] leading-none font-bold text-surface';

export const sentCompact: string = `${panel} flex flex-col gap-[6px] px-[12px] py-[12px] desktop:hidden`;

export const compactTitle: string =
  'text-2xl leading-none font-black text-text-ink uppercase md:text-[23px]';

export const compactBody: string = 'text-md leading-[20px] font-bold text-text-muted';

// ---- Operative and waiting panels ----

export const status: string =
  `${panel} flex min-h-[88px] items-center gap-[12px] px-[12px] py-[12px] ` +
  'desktop:h-[102px] desktop:justify-center desktop:px-[130px] desktop:py-0';

export const statusDots: string =
  'hidden desktop:absolute desktop:top-[17px] desktop:left-[45px] desktop:block';

export const statusText: string =
  'flex min-w-0 flex-1 flex-col gap-[6px] desktop:flex-none desktop:items-center desktop:gap-[12px]';

export const statusTitle: string =
  'text-2xl leading-none font-black uppercase md:text-[23px] desktop:text-center ' +
  'desktop:text-[36px]';

export const statusTones = {
  strong: 'text-text-ink desktop:text-[38px]',
  muted: 'text-text-ink desktop:text-text-gray',
} as const;

export const statusBody: string =
  'text-sm leading-[18px] font-bold text-text-muted md:text-md desktop:text-center ' +
  'desktop:text-[20px] desktop:leading-none desktop:text-text-gray';

export const statusAction: string =
  'shrink-0 desktop:absolute desktop:top-[30px] desktop:right-[21px]';

export const passWrap: string = 'flex flex-col items-end gap-[4px]';

export const pass: string =
  `${buttonInteraction} inline-flex h-[40px] w-[84px] items-center justify-center rounded-pill ` +
  'text-lg leading-none font-black uppercase md:h-[42px] md:w-[96px] ' +
  'desktop:h-[42px] desktop:w-[116px] desktop:text-[18px]';

export const passLive: string =
  'border-(length:--stroke-medium) border-border bg-surface text-text-slate ' +
  'shadow-button-muted not-disabled:hover:shadow-button-muted-hover';

export const passIdle: string = 'bg-surface-muted text-text-muted shadow-button-muted';
