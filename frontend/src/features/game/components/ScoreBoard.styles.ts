/**
 * Score recipes. `tab` is the desktop scoreboard hanging from the top edge (526×108 in
 * the 1920px design, drawn at 80%); `pill` is the phone and tablet score at the head of
 * the page.
 */

export const redText: string = 'text-secondary-dark';
export const blueText: string = 'text-primary-deep';

export const tab = {
  root:
    'flex h-[86px] w-[421px] items-center justify-center rounded-b-[16px] bg-surface ' +
    'shadow-[0_6px_8px_var(--color-shadow-warm)]',
  content: 'flex items-center gap-[12px] leading-none font-black uppercase',
  icon: 'text-[34px]',
  team: 'text-[28px]',
  numbers: 'mx-[14px] flex items-center gap-[18px] text-[42px] text-text-ink',
} as const;

export const pill = {
  root:
    'inline-flex h-[40px] items-center rounded-lg bg-surface px-[10px] ' +
    'shadow-[0_3px_6px_var(--color-shadow-warm)] md:h-[49px] md:px-[12px]',
  content: 'flex items-center gap-[6px] leading-none font-black uppercase md:gap-[8px]',
  icon: '',
  team: 'text-md md:text-lg',
  numbers: 'flex items-center gap-[4px] text-xl text-text-ink md:text-2xl',
} as const;
