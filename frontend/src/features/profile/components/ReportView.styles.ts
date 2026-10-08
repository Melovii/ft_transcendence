/**
 * Class recipes for Report Player, which takes the place of the profile inside the same
 * Profile pop-up. It uses the pop-up's card, the Settings field and hint type, and the
 * design system's option rows and buttons.
 */

/** Clear of the close button, which sits over the header's top-right corner. */
export const header: string = 'flex w-full flex-col gap-[4px] pr-[48px] md:gap-[3px]';

export const title: string =
  'text-3xl leading-[1.3] font-black [overflow-wrap:anywhere] text-text-ink normal-case ' +
  'outline-none md:text-[26px]';

export const subtitle: string = 'text-md leading-[1.5] font-regular text-text-muted';

export const form: string = 'flex flex-col gap-[16px] md:gap-[14px]';

export const label: string =
  'text-md leading-[22px] font-black tracking-[1px] text-text-slate uppercase ' +
  'md:text-xs md:leading-[18px] md:tracking-[0.8px]';

export const reasons: string = 'flex flex-col gap-[8px] md:gap-[6px]';

/** One reason: a selectable row, the native radio kept for keyboard and screen readers. */
export const reason: string =
  'flex cursor-pointer items-center gap-[12px] rounded-[16px] border-(length:--stroke-thin) ' +
  'border-border bg-surface px-[14px] py-[12px] text-lg leading-tight font-bold ' +
  'text-text-ink transition-[border-color,background-color] duration-150 ' +
  'hover:border-primary-deep has-checked:border-primary has-checked:bg-primary-sky/10 ' +
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 ' +
  'has-focus-visible:outline-primary md:py-[10px] md:text-[16px]';

export const radio: string = 'size-[18px] shrink-0 accent-primary';

export const textarea: string =
  'min-h-[96px] w-full resize-y rounded-[16px] border-(length:--stroke-thin) border-border ' +
  'bg-surface px-[14px] py-[10px] text-lg leading-snug font-medium text-text-ink ' +
  'shadow-alert placeholder:text-text-placeholder hover:border-primary-deep ' +
  'focus:border-primary focus:bg-surface-raised read-only:bg-surface-muted md:text-[16px]';

export const counter: string =
  'self-end text-sm leading-none font-bold text-text-muted tabular-nums';

export const hint: string =
  'text-md leading-[22px] font-regular text-text-muted md:text-sm md:leading-[18px]';

export const error: string =
  'text-center text-md leading-[1.3] font-bold text-accent-red md:text-sm';

export const actions: string = 'grid w-full grid-cols-2 gap-[13px]';

/** Geometry of the report's buttons; the shared `Button` draws their fill. */
export const button: string =
  'h-[52px] rounded-[18px] px-[12px] text-xl leading-none font-bold whitespace-nowrap ' +
  'md:h-[45px] md:text-[18px]';

export const cancel: string = 'aria-disabled:opacity-60';

export const submit: string = 'aria-disabled:opacity-70';

export const outcome: string =
  'flex flex-col items-center gap-[12px] px-[8px] pt-[8px] pb-[4px] text-center';

export const outcomeIcon: string = 'text-[44px] md:text-[40px]';

export const outcomeTone = {
  success: 'text-success-deep',
  neutral: 'text-text-muted',
};

export const outcomeBody: string =
  'max-w-[400px] text-lg leading-[1.4] font-regular text-text-muted md:text-md';

export const done: string = 'mt-[4px] w-full md:w-[240px]';
