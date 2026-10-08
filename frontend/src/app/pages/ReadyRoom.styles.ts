/**
 * Class recipes for the Ready Room.
 *
 * Three designed layouts: mobile (390px) is the base, `md:` is the tablet layout (834px)
 * and `desktop:` is the 1920×1080 composition drawn at 80% of the design's size, like Room
 * Discovery. On desktop the room fills the space left of a 388px Your Setup sidebar, in a
 * 932px column centred in that space; phones and tablets stack everything in one column
 * and open Your Setup in a dialog, with Ready and Leave Room at the foot of the page.
 */

export const page: string = 'flex flex-1 flex-col desktop:flex-row';

export const main: string =
  'flex flex-1 flex-col px-3 py-3 md:px-6 md:py-[32px] desktop:min-w-0 ' +
  'desktop:bg-surface-raised desktop:px-3 desktop:pt-[31px] desktop:pb-[48px]';

export const column: string =
  'mx-auto flex w-full flex-1 flex-col gap-2 md:gap-[20px] desktop:max-w-[932px] ' +
  'desktop:flex-none desktop:gap-0';

// ---- Room information ----

export const title: string =
  'text-center text-3xl leading-[40px] font-black text-text-ink normal-case md:text-4xl ' +
  'md:leading-[48px] desktop:text-[40px] desktop:leading-[40px]';

export const code: string = 'desktop:mt-[10px]';

export const hint: string =
  'text-center text-md leading-[22px] font-regular text-text-muted md:text-lg ' +
  'md:leading-[28px] desktop:mt-[10px] desktop:text-[18px] desktop:leading-[18px] ' +
  'desktop:font-medium desktop:text-text-ink';

export const capacity: string = 'desktop:mt-[13px]';

export const settings: string = 'desktop:mt-[8px]';

// ---- Hero (desktop) ----

export const hero: string = 'relative hidden desktop:mt-[13px] desktop:block desktop:h-[167px]';

export const mascot: string =
  'pointer-events-none absolute top-0 left-[33px] z-10 h-[170px] w-[306px] max-w-none';

export const headline: string =
  'absolute top-[10px] left-[364px] text-[50px] leading-[50px] font-black tracking-[-0.8px] ' +
  'whitespace-nowrap text-text-ink normal-case';

export const subtitle: string =
  'absolute top-[70px] left-[364px] max-w-[568px] text-[22px] leading-[26px] font-medium ' +
  'text-text-ink';

// ---- Teams ----

export const teams: string =
  'flex flex-col gap-[10px] md:gap-[20px] desktop:flex-row desktop:items-stretch ' +
  'desktop:gap-[36px]';

export const team: string = 'desktop:flex-1';

export const choosing: string = 'mt-1 md:mt-0 desktop:mt-[24px]';

// ---- Foot of the page (phones and tablets) ----

export const foot: string = 'mt-auto flex flex-col gap-2 pt-2 md:gap-[20px] md:pt-0 desktop:hidden';

export const counter: string =
  'text-center text-md leading-[22px] font-bold text-text-muted md:text-lg md:leading-[28px]';

export const readyInline: string = 'h-[56px] rounded-md text-3xl';

export const leaveInline: string = 'h-[48px] rounded-md text-[25px]';

// ---- Your Setup sidebar (desktop) ----

export const sidebar: string =
  'hidden w-[388px] shrink-0 flex-col items-stretch bg-surface-muted px-[33px] pt-[19px] ' +
  'pb-[40px] desktop:flex';

export const profile: string = 'self-center';

export const setupTitle: string =
  'mt-[44px] text-center text-[28px] leading-[28px] font-black text-text-ink uppercase';

export const setupPanel: string = 'mt-[27px]';

export const readyButton: string = 'mt-[26px]';

export const sidebarCounter: string =
  'mt-[12px] text-center text-[18px] leading-[18px] font-bold text-text-ink';

export const feedback: string = 'mt-[10px] min-h-[18px]';

export const divider: string = 'mt-[12px] h-[2px] w-full shrink-0 bg-disabled';

export const leaveSidebar: string = 'mt-[17px] h-[42px] rounded-[11px] text-[20px]';

// ---- Leave Room button ----

/** The shared outline `Button` draws the color; the page adds its geometry and its lift. */
export const leave: string = 'gap-[10px] leading-none font-bold';

export const leaveSurface: string =
  'bg-surface shadow-[0_4px_7px_var(--color-shadow-warm-soft)] ' +
  'not-disabled:hover:shadow-[0_6px_10px_var(--color-shadow-warm-soft)]';

export const leaveIcon: string = 'text-[0.9em]';

// ---- Room states ----

export const state: string = 'flex flex-1 items-center justify-center px-3 py-6';

export const toasts: string = 'desktop:pr-[388px]';
