/**
 * Class recipes shared by the Create Room and Join Room dialogs.
 *
 * Both are compact cards over the dimmed Room Discovery page, as tall as their content
 * needs; the shared `Dialog` shell draws the backdrop and the close button. Mobile is the
 * base: the card spans the screen less a 16px margin on each side. From `md:` it is 440px
 * wide, with the design's artwork, type and controls scaled to that width.
 */

// ---- Surface ----

export const dialog: string =
  'max-w-[440px] items-center rounded-xl bg-linear-to-l from-surface-raised to-background ' +
  'px-3 pb-[20px] shadow-auth-dialog md:rounded-2xl md:px-12 md:pb-[28px]';

export const title: string =
  'w-full text-center text-4xl leading-[34px] font-black tracking-[-0.8px] text-text ' +
  'normal-case';

/** From `md:` the subtitle may run into the side padding, so it stays on one line. */
export const subtitle: string =
  'mt-[8px] w-full text-center text-lg leading-[22px] font-medium text-text-black ' +
  'md:w-max md:max-w-[392px]';

// ---- Result banner ----

export const alertTone = {
  error: 'bg-secondary-deep',
  success: 'bg-success-deep',
};

export const alertBase: string =
  'flex w-full flex-col gap-[4px] rounded-[10px] px-[14px] py-[8px] text-surface ' +
  'shadow-alert motion-safe:animate-rise-in';

export const alertTitle: string = 'text-lg leading-[20px] font-bold tracking-[-0.5px]';

export const alertBody: string = 'text-md leading-[18px] font-regular tracking-[-0.35px]';

export const alertAction: string =
  'mt-[2px] w-fit cursor-pointer rounded-sm text-md leading-[18px] font-bold underline ' +
  'underline-offset-2 hover:no-underline';

// ---- Field message ----

export const message: string =
  'flex items-center gap-2 text-md leading-[18px] font-regular text-accent-red';

export const messageBadge: string =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-pill bg-accent-red ' +
  'text-[10px] text-surface';

// ---- Actions ----

export const actions: string = 'flex w-full flex-col gap-[10px]';

/** Primary submit and outline Cancel, both drawn by the shared `Button` at full width. */
export const submit: string =
  'h-12 rounded-md px-4 text-xl leading-tight font-bold tracking-tight whitespace-nowrap ' +
  'uppercase';

export const submitIcon: string =
  'mr-[10px] inline-flex h-[22px] w-[22px] items-center justify-center rounded-pill ' +
  'bg-surface align-[-4px] text-md';

export const cancel: string =
  'h-11 gap-2 rounded-lg px-4 text-xl leading-tight font-bold tracking-tight ' +
  'whitespace-nowrap uppercase';
