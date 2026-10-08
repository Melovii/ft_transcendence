/**
 * Class recipes for the game countdown over the Ready Room.
 * Phones are the base, `md:` draws the design at full size and `desktop:` at 80%, like the
 * page behind them.
 */

// ---- Countdown ----

export const countdown: string =
  'max-w-[358px] items-center gap-[20px] rounded-xl bg-surface px-3 py-[32px] ' +
  'shadow-auth-dialog outline-none md:h-[480px] md:max-w-[600px] md:justify-center ' +
  'md:gap-[28px] md:rounded-2xl md:py-0 desktop:h-[384px] desktop:max-w-[480px] ' +
  'desktop:gap-[22px] desktop:rounded-[28px]';

export const countdownEyebrow: string =
  'text-lg leading-none font-bold tracking-[4px] text-text-muted uppercase md:text-xl ' +
  'md:tracking-[5px] desktop:text-[16px] desktop:tracking-[4px]';

export const countdownRing: string =
  'flex size-[200px] shrink-0 items-center justify-center rounded-pill ' +
  'bg-linear-to-b from-primary-bright to-primary-sky ' +
  'shadow-[0_8px_2px_var(--color-shadow-primary),0_12px_20px_var(--color-shadow-medium)] ' +
  'md:size-[264px] desktop:size-[211px]';

export const countdownNumber: string =
  'text-[128px] leading-none font-bold text-surface motion-safe:animate-pop-in ' +
  'md:text-[170px] desktop:text-[136px]';

export const countdownHint: string =
  'max-w-[440px] text-center text-xl leading-[26px] font-regular text-text-slate ' +
  'md:text-2xl md:leading-[28px] desktop:max-w-[352px] desktop:text-[18px] ' +
  'desktop:leading-[22px]';
