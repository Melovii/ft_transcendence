import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for the Game Board.
 *
 * Three designed layouts: mobile (390px) is the base, `md:` is the tablet layout (834px)
 * and `desktop:` is the 1920×1080 composition drawn at 80% of the design's size, like the
 * Ready Room. On desktop the scoreboard hangs from the top edge between the Leave Game
 * button and the profile header, and a 853px column for the clue panel and the board sits
 * between the two 176px team cards. Phones and tablets stack everything in one column and
 * move the lineups to the foot of the page.
 */

export const page: string =
  'flex flex-1 flex-col px-[16px] pt-[16px] pb-[20px] md:px-[48px] md:pt-[32px] md:pb-[36px] ' +
  'desktop:px-0 desktop:pt-0 desktop:pb-[40px]';

export const stage: string =
  'mx-auto flex w-full flex-1 flex-col md:max-w-[738px] desktop:relative ' +
  'desktop:max-w-[1536px] desktop:min-h-[864px]';

// ---- Header ----

export const header: string = 'flex items-center gap-[8px] desktop:block';

export const leave: string =
  `${buttonInteraction} inline-flex size-[36px] shrink-0 items-center justify-center ` +
  'rounded-pill bg-surface text-lg text-text-ink shadow-[0_4px_6px_var(--color-shadow-warm)] ' +
  'not-disabled:hover:shadow-[0_6px_9px_var(--color-shadow-warm)] md:size-[46px] md:text-xl ' +
  'desktop:absolute desktop:top-[19px] desktop:left-[32px] desktop:text-[24px]';

export const scorePill: string = 'desktop:hidden';

export const scoreTab: string =
  'hidden desktop:absolute desktop:top-0 desktop:left-1/2 desktop:flex desktop:-translate-x-1/2';

export const profile: string = 'ml-auto desktop:absolute desktop:top-[12px] desktop:right-[17px]';

// ---- Heading and body ----

export const center: string = 'flex flex-col desktop:items-center desktop:pt-[119px]';

export const heading: string = 'mt-[12px] md:mt-[20px] desktop:mt-0';

export const instruction: string =
  'hidden text-center text-[18px] leading-none font-medium text-text-ink desktop:mt-[7px] ' +
  'desktop:block';

export const body: string =
  'mt-[12px] flex flex-col md:mt-[20px] desktop:grid desktop:grid-cols-[176px_853px_176px] ' +
  'desktop:items-start desktop:gap-x-[30px]';

export const bodySpymaster: string = 'desktop:mt-[25px]';

export const bodyOperative: string = 'desktop:mt-[15px]';

export const teamCard: string = 'hidden desktop:flex';

export const column: string = 'flex min-w-0 flex-col gap-[12px] md:gap-[20px]';

export const columnSpymaster: string = 'desktop:gap-[17px]';

export const columnOperative: string = 'desktop:gap-[30px]';

export const guessFeedback: string = 'text-center empty:hidden';

/** Confirm Guess beside Pass in the Operative's panel. */
export const guessActions: string = 'flex items-start gap-[10px]';

// ---- Lineups (phones and tablets) ----

export const summaries: string = 'mt-auto flex gap-[10px] pt-[20px] desktop:hidden';

/** Members choosing the free seat of a paused match, under the board, at every size. */
export const unseated: string = 'mt-[16px] desktop:mx-auto desktop:mt-[20px] desktop:max-w-[960px]';

// ---- Game over panel ----

/** The finished match's panel grows to hold its two actions under the result. */
export const overPanel: string =
  'desktop:h-auto desktop:flex-col desktop:gap-[14px] desktop:py-[18px]';

export const overAction: string = 'desktop:static';

export const overActions: string =
  'flex flex-col items-stretch gap-[6px] desktop:flex-row desktop:gap-[12px]';

/** Geometry of the game-over buttons; Back to Lobby is the shared primary `Button`. */
export const overButton: string =
  'h-[40px] rounded-pill px-[14px] text-md leading-none font-black whitespace-nowrap ' +
  'uppercase desktop:h-[42px] desktop:px-[20px] desktop:text-[16px]';

/** Show Results: raised on a two-pixel border, quieter than the primary beside it. */
export const overSecondary: string =
  `${buttonInteraction} inline-flex items-center justify-center ${overButton} ` +
  `${overButton} border-(length:--stroke-medium) border-border bg-surface text-text-slate ` +
  'shadow-button-muted not-disabled:hover:shadow-button-muted-hover';
