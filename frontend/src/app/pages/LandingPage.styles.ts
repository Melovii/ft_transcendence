import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for the landing page.
 *
 * The page has three designed layouts: mobile (390px) is the base, `md:` is the tablet
 * layout (834px) and `desktop:` is the 1920×1080 desktop composition. The desktop layout
 * places every block on a 1920px stage at the coordinates of the design, so the stage is
 * centred on the viewport and the page clips what falls outside it. Offsets and sizes on
 * the stage are the design's own geometry; colors, shadows and radii come from the theme.
 */

export const page: string =
  'relative min-h-screen overflow-hidden bg-background ' +
  'desktop:min-h-[max(100vh,1080px)] desktop:bg-surface-raised';

export const stage: string =
  'mx-auto flex flex-col gap-[14px] px-3 pt-3 pb-[20px] ' +
  'md:max-w-[834px] md:gap-4 md:px-6 md:pb-3 ' +
  'desktop:relative desktop:ml-[calc(50%_-_960px)] desktop:block desktop:h-[1080px] ' +
  'desktop:w-[1920px] desktop:max-w-none desktop:p-0';

/** Groups that stack on mobile and tablet and hand their children to the stage on desktop. */
export const stack: string = 'flex flex-col gap-[14px] md:gap-4 desktop:block';

/*
 * The edge decorations bleed off the page. Below 1920px they stay on the stage, which the
 * page clips; above it they follow the viewport edges so their cut sides stay off-screen.
 */
export const edgeLeft: string =
  'pointer-events-none absolute top-[-52px] left-[calc(min(0px,50%_-_960px)_-_84px)] ' +
  'hidden h-[1141px] w-[467px] max-w-none desktop:block';

export const edgeRight: string =
  'pointer-events-none absolute top-[33px] right-[calc(min(0px,50%_-_960px)_-_148px)] ' +
  'hidden h-[1047px] w-[484px] max-w-none desktop:block';

// ---- Header ----

export const header: string =
  'flex justify-end desktop:absolute desktop:top-[45px] desktop:left-[1230px] ' +
  'desktop:items-center desktop:gap-[20px]';

const outlineButton: string =
  `${buttonInteraction} shrink-0 items-center justify-center rounded-lg ` +
  'border-(length:--stroke-default) border-primary-deep text-center font-bold leading-tight ' +
  'whitespace-nowrap text-primary-sky not-disabled:hover:bg-primary/10';

/** Log In: the shared outline `Button` at the header's geometry. */
export const logIn: string =
  'h-10 w-24 rounded-lg text-xl leading-tight font-bold whitespace-nowrap md:h-12 md:w-30 ' +
  'md:text-2xl desktop:h-[47px] desktop:w-[111px] desktop:text-[22px]';

export const topPlayNow: string =
  `${buttonInteraction} hidden h-[49px] w-[142px] items-center justify-center rounded-[22px] ` +
  'bg-accent-yellow text-2xl leading-tight font-black whitespace-nowrap text-text-ink ' +
  'shadow-button-cta-large not-disabled:hover:shadow-button-cta-large-hover ' +
  'not-disabled:hover:brightness-105 desktop:inline-flex';

// ---- Hero ----

export const heroIllustration: string =
  'block aspect-[358/231] h-auto w-full object-contain md:aspect-[738/476] ' +
  'desktop:absolute desktop:top-[117px] desktop:left-[954px] desktop:aspect-auto ' +
  'desktop:h-[455px] desktop:w-[706px]';

export const heroCopy: string =
  'flex flex-col items-center gap-[14px] text-center md:gap-4 ' +
  'desktop:absolute desktop:top-[115px] desktop:left-[414px] desktop:w-[600px] ' +
  'desktop:items-start desktop:gap-0 desktop:text-left';

export const badge: string =
  'hidden h-9 w-[205px] items-center justify-center rounded-[18px] bg-surface-muted ' +
  'text-[16px] leading-tight font-black tracking-[0.5px] text-text-ink desktop:flex';

/*
 * Line heights are whole pixels, as the design rounds them. The small `top` and padding
 * offsets on the headline, the hero Play Now label and the How To Play title set the
 * glyphs on the baseline the design draws them on.
 */
export const headline: string =
  'relative top-[2px] text-4xl leading-[34px] font-black text-text-ink normal-case ' +
  'md:top-0 md:text-display md:leading-[55px] ' +
  'desktop:mt-[6px] desktop:text-[50px] desktop:leading-[56px] desktop:tracking-[-1px]';

/** Mobile breaks the headline after its first sentence; wider layouts keep one line. */
export const headlinePart: string = 'block md:inline';

export const tagline: string = 'hidden whitespace-pre-line desktop:block';

export const descriptionShort: string =
  'text-lg leading-[22px] font-regular text-text-muted md:text-2xl md:leading-[28px] ' +
  'desktop:hidden';

export const description: string =
  'hidden w-[540px] text-xl leading-[24px] font-medium whitespace-pre-line text-text-ink ' +
  'desktop:block';

/** Play Now: the shared primary `Button` at the hero's geometry. */
export const heroPlayNow: string =
  'h-14 rounded-lg text-3xl leading-tight font-bold whitespace-nowrap uppercase md:h-17 ' +
  'md:pt-[2px] md:text-4xl desktop:h-[61px] desktop:rounded-md desktop:text-[29px]';

export const heroPlayNowPlacement: string = 'w-full desktop:mt-[4px] desktop:w-[211px]';

export const learnMore: string =
  `${outlineButton} hidden h-[43px] w-[148px] text-xl uppercase ` +
  'desktop:mt-[19px] desktop:flex';

// ---- How to play ----

export const howToPlay: string = `${stack} desktop:absolute desktop:inset-x-0 desktop:top-[584px] desktop:h-[285px]`;

export const howToPlayTitle: string =
  'text-center text-xl leading-[32px] font-black text-text-ink md:text-3xl md:leading-[43px] ' +
  'desktop:absolute desktop:inset-x-0 desktop:top-px desktop:text-[29px] desktop:leading-[29px] ' +
  'desktop:text-text';

export const divider: string =
  'hidden h-[18px] w-[430px] max-w-none desktop:absolute desktop:top-[9px] desktop:block';

export const step: string =
  'flex items-center gap-[12px] ' +
  'desktop:absolute desktop:top-[47px] desktop:h-[238px] desktop:w-[352px] ' +
  'desktop:rounded-[16px] desktop:bg-surface desktop:shadow-how-to-play';

export const stepTile: string =
  'flex size-12 shrink-0 items-center justify-center rounded-md text-[28px] text-surface ' +
  'md:size-16 md:text-[36px] desktop:hidden';

export const stepIllustration: string =
  'hidden w-[224px] max-w-none desktop:absolute desktop:top-[51px] desktop:left-[64px] ' +
  'desktop:block';

export const stepCopy: string = 'flex min-w-0 flex-col';

export const stepTitle: string =
  'text-xl leading-[32px] font-black text-text-ink normal-case md:text-3xl md:leading-[43px] ' +
  'desktop:absolute desktop:inset-x-0 desktop:top-[19px] desktop:text-center ' +
  'desktop:leading-tight desktop:uppercase';

export const stepDescription: string =
  'text-md leading-[22px] font-regular text-text-muted md:text-xl md:leading-[32px] ' +
  'desktop:absolute desktop:top-[183px] desktop:left-[30px] desktop:w-[292px] ' +
  'desktop:text-center desktop:text-[21px] desktop:leading-[24px] desktop:whitespace-pre-line ' +
  'desktop:text-text-ink';

// ---- Community ----

export const communityArtwork: string =
  'absolute top-[884px] left-[714px] h-[95px] w-[205px] overflow-hidden';

export const communityAvatar: string =
  'absolute size-11 rounded-pill object-cover shadow-avatar ' +
  'outline-2 -outline-offset-1 outline-surface';

export const onlineDot: string =
  'absolute size-[13px] rounded-pill bg-online outline-2 -outline-offset-1 outline-surface';

export const communityMessage: string =
  'absolute top-[888px] left-[919px] w-[380px] text-xl leading-[22px] font-bold ' +
  'whitespace-pre-line text-text-ink';

export const inviteFriends: string =
  `${buttonInteraction} absolute top-[936px] left-[919px] flex h-[43px] w-[178px] ` +
  'items-start gap-[9px] rounded-[22px] bg-surface pt-[10px] pl-[14px] text-lg leading-tight ' +
  'font-bold whitespace-nowrap text-text-ink shadow-button-icon-secondary ' +
  'not-disabled:hover:shadow-button-icon-secondary-hover';

// ---- Footer ----

export const footer: string =
  'flex flex-col items-center gap-[9px] text-center ' +
  'desktop:absolute desktop:inset-x-0 desktop:top-[1024px]';

export const footerLinks: string =
  'flex flex-wrap justify-center text-lg leading-tight font-regular text-text-ink';

export const footerLink: string = 'text-text-ink hover:underline';

/** Beside the legal links on desktop, above them on narrower screens. */
export const language: string =
  'desktop:absolute desktop:top-[-4px] desktop:left-[calc(50%_+_190px)]';

export const copyright: string = 'text-md leading-tight font-medium text-text-black';
