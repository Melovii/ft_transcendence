/**
 * Class recipes for what Delete Account? adds to the shared confirmation: the in-match
 * warning and the typed-username field.
 */

export const warning: string =
  'mt-[10px] max-w-[440px] text-md leading-[20px] font-bold text-accent-red ' +
  'desktop:max-w-[352px] desktop:text-[14px]';

/** The field sits in the form, which also carries its spacing. */
export const field: string = 'mt-[20px] flex w-full flex-col gap-[8px] text-left';

/** Sentence case, so the username reads exactly as the user must type it. */
export const confirmLabel: string =
  'text-md leading-[20px] font-bold text-text-ink md:text-[15px] [&_strong]:font-black ' +
  '[&_strong]:text-accent-red';
