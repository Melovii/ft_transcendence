import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for the Privacy Policy and Terms of Service pages.
 *
 * Mobile (390px) is the base, `md:` is the tablet layout (834px) and `desktop:` is the
 * 1920px composition: a white top bar over a warm backdrop, with the document card
 * centred at 1360px wide and its sections in two columns. Smaller layouts stack the
 * sections in one column on the page background.
 */

export const page: string =
  'flex min-h-screen flex-col gap-[20px] bg-background px-3 pt-[20px] pb-4 md:px-6 ' +
  'desktop:gap-0 desktop:p-0 ' +
  'desktop:bg-[radial-gradient(ellipse_60%_60%_at_50%_48%,var(--color-border)_0%,var(--color-backdrop)_100%)]';

// ---- Top bar ----

export const topBar: string =
  'flex items-center justify-between desktop:h-[96px] desktop:bg-surface desktop:px-[120px]';

export const wordmark: string =
  'rounded-sm text-[23px] leading-[23px] font-black whitespace-nowrap text-text-ink ' +
  'md:text-4xl md:leading-[32px]';

export const topLinks: string = 'flex items-center gap-[34px]';

export const topLink: string =
  'hidden rounded-sm text-xl leading-[20px] font-bold whitespace-nowrap text-text-gray ' +
  'transition-colors hover:text-primary-sky aria-[current=page]:text-primary-sky desktop:inline';

export const logIn: string =
  `${buttonInteraction} inline-flex h-[44px] w-[110px] shrink-0 items-center justify-center ` +
  'rounded-lg bg-primary text-[22px] leading-[22px] font-bold whitespace-nowrap text-surface ' +
  'shadow-button-primary not-disabled:hover:bg-primary-bright ' +
  'not-disabled:hover:shadow-button-primary-hover md:h-[48px] md:w-[150px]';

// ---- Document card ----

export const main: string = 'flex flex-1 flex-col desktop:px-3 desktop:py-[56px]';

export const card: string =
  'flex w-full flex-col gap-[26px] rounded-[32px] bg-surface px-[20px] py-4 shadow-document ' +
  'md:p-[40px] desktop:mx-auto desktop:max-w-[1360px] desktop:px-[60px] desktop:py-[52px]';

export const title: string =
  'text-4xl leading-[32px] font-black text-text-ink normal-case md:text-display md:leading-[52px]';

export const lastUpdated: string =
  'text-lg leading-[18px] font-bold tracking-[1px] text-text-muted uppercase';

export const intro: string =
  'text-lg leading-[24px] font-regular text-text-slate md:text-xl md:leading-[27px]';

export const divider: string = 'h-[2px] w-full shrink-0 border-0 bg-border';

export const columns: string =
  'flex flex-col gap-[20px] md:gap-[28px] desktop:flex-row desktop:gap-[56px]';

export const column: string = 'flex min-w-0 flex-col gap-[22px] desktop:flex-1';

export const section: string = 'flex flex-col gap-[7px]';

export const sectionTitle: string = 'text-2xl leading-[23px] font-black text-text-ink normal-case';

export const sectionBody: string = 'flex flex-col gap-2';

export const paragraph: string = 'text-lg leading-[24px] font-regular text-text-faint';

export const inlineLink: string =
  'w-fit rounded-sm text-lg leading-[24px] font-bold wrap-anywhere text-primary-sky underline ' +
  'underline-offset-2 hover:text-primary';

// ---- Footer ----

export const footer: string =
  'flex flex-col items-center gap-2 text-center desktop:pt-0 desktop:pb-[46px]';

/** The top bar carries the document links on desktop, so the footer takes them below it. */
export const footerLinks: string =
  'flex flex-wrap justify-center text-lg leading-tight font-regular text-text-ink desktop:hidden';

export const footerLink: string =
  'rounded-sm text-text-ink hover:underline aria-[current=page]:text-primary-sky';

export const footerNote: string = 'text-md leading-[14px] font-regular text-text-faint';
