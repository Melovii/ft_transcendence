import { buttonInteraction } from '@shared/ui';

/**
 * Class recipes for the chat widget: launchers, panel, conversation list and conversation.
 *
 * Sizes follow the design's three layouts. Phones (390px) are the base: the panel fills
 * the screen inside a 16px gutter. From `md:` (834px) the panel is the design's 430×610
 * card floating over the page's bottom-right corner. From `desktop:` everything is the
 * 1920×1080 desktop composition at 80%, the scale the desktop pages use: a 344×488 card
 * above the launcher. Colors, radii and shadows come from the theme.
 */

// ---- Launchers ----

/** Room Discovery on desktop: the Chat pill in the bottom-right corner. */
export const pill: string =
  `${buttonInteraction} fixed right-[24px] bottom-[22px] z-(--z-chat) hidden h-[81px] ` +
  'w-[195px] rounded-[30px] bg-surface text-left shadow-[0_6px_10px_var(--color-shadow-warm-medium)] ' +
  'hover:shadow-[0_8px_14px_var(--color-shadow-warm-medium)] desktop:block';

export const pillIcon: string = 'absolute top-[20px] left-[26px] text-[38px] text-primary';

export const pillBadge: string =
  'absolute top-[10px] left-[54px] flex size-[23px] items-center justify-center rounded-pill ' +
  'bg-secondary-deep text-[14px] leading-none font-bold text-surface tabular-nums';

export const pillTitle: string =
  'absolute top-[19px] left-[82px] text-[22px] leading-none font-black text-text-ink';

export const pillCaption: string =
  'absolute top-[46px] left-[82px] text-[11px] leading-none font-medium text-text-ink';

/**
 * The round chat button: 48px below desktop (the design's icon button), and in the Ready
 * Room and the Game on desktop the 78px chat button drawn at 80%.
 */
export const round: string =
  `${buttonInteraction} inline-flex size-[48px] shrink-0 items-center justify-center ` +
  'rounded-pill bg-primary text-[22px] text-surface shadow-[0_3px_1px_var(--color-shadow-primary)] ' +
  'hover:bg-primary-bright';

export const roundFloating: string =
  'fixed right-[16px] bottom-[16px] z-(--z-chat) desktop:right-[15px] desktop:bottom-[20px] ' +
  'desktop:size-[62px] desktop:bg-primary-sky desktop:text-[32px] ' +
  'desktop:shadow-[0_4px_7px_var(--color-shadow-launcher)]';

export const roundBadge: string =
  'absolute -top-[4px] -right-[4px] flex size-[22px] items-center justify-center rounded-pill ' +
  'border-(length:--stroke-medium) border-surface bg-secondary-deep text-[11px] leading-none ' +
  'font-black text-surface tabular-nums';

/** Below desktop the Room Discovery header carries the round button; desktop shows the pill. */
export const headerButton: string = 'relative desktop:hidden';

// ---- Panel ----

export const panel: string =
  'fixed inset-[16px] z-(--z-chat) flex flex-col overflow-hidden rounded-xl bg-surface ' +
  'shadow-[0_14px_24px_var(--color-shadow-warm-medium)] motion-safe:animate-pop-in ' +
  'md:inset-auto md:right-[32px] md:bottom-[120px] md:h-[min(610px,calc(100dvh-152px))] ' +
  'md:w-[430px] desktop:right-[32px] desktop:bottom-[120px] ' +
  'desktop:h-[min(488px,calc(100dvh-140px))] desktop:w-[344px] desktop:rounded-[22px] ' +
  'desktop:shadow-[0_11px_19px_var(--color-shadow-warm-medium)]';

/** Clear of the Ready Room's 388px Your Setup sidebar on desktop. */
export const panelBesideSetup: string = 'desktop:right-[420px]';

/** The phone panel follows the visual viewport, so the on-screen keyboard never covers it. */
export const panelMobileHeight: string = 'max-md:h-[calc(100dvh-32px)] max-md:bottom-auto';

export const header: string =
  'flex shrink-0 items-center justify-between gap-[12px] bg-linear-to-b from-primary-bright ' +
  'to-primary-sky px-[18px] py-[16px] text-surface desktop:gap-[10px] desktop:px-[14px] ' +
  'desktop:py-[13px]';

export const threadHeader: string =
  'flex shrink-0 items-center gap-[12px] bg-linear-to-b from-primary-bright to-primary-sky ' +
  'px-[18px] py-[14px] text-surface desktop:gap-[10px] desktop:px-[14px] desktop:py-[11px]';

export const headerTitle: string =
  'text-3xl leading-none font-bold text-surface normal-case desktop:text-[22px]';

export const headerIconButton: string =
  'inline-flex size-[32px] shrink-0 items-center justify-center rounded-pill text-[22px] ' +
  'text-surface transition-colors hover:bg-surface/20 focus-visible:bg-surface/20 ' +
  'desktop:size-[26px] desktop:text-[18px]';

// ---- Conversation list ----

export const listBody: string =
  'flex min-h-0 flex-1 flex-col gap-[12px] overflow-y-auto overscroll-contain bg-surface-raised ' +
  'p-[16px] desktop:gap-[10px] desktop:p-[13px]';

export const search: string =
  'relative flex h-[46px] shrink-0 items-center rounded-pill border-(length:--stroke-default) ' +
  'border-border bg-surface shadow-alert focus-within:border-primary-sky desktop:h-[37px]';

export const searchIcon: string =
  'pointer-events-none absolute left-[15px] text-[18px] text-text-slate desktop:left-[12px] ' +
  'desktop:text-[14px]';

export const searchInput: string =
  'h-full w-full rounded-pill bg-transparent pr-[16px] pl-[44px] text-lg font-regular ' +
  'text-text-ink outline-none placeholder:text-text desktop:pl-[35px] desktop:text-[14px]';

export const tabs: string =
  'relative flex h-[44px] shrink-0 items-start gap-[8px] desktop:h-[35px]';

export const tab: string =
  'relative h-full px-[8px] pt-[10px] text-lg leading-none font-bold text-text-ink ' +
  'aria-[selected=false]:text-text-muted hover:text-text-ink desktop:pt-[8px] ' +
  'desktop:text-[14px]';

export const tabIndicator: string =
  'absolute right-0 bottom-[3px] left-0 h-[3px] rounded-pill bg-text-ink';

export const sectionLabel: string =
  'shrink-0 text-sm leading-none font-black tracking-[2px] text-text-muted uppercase ' +
  'desktop:text-[10px] desktop:tracking-[1.6px]';

export const rows: string = 'flex flex-col gap-[12px] desktop:gap-[10px]';

const rowBase: string =
  'group/row flex w-full min-w-0 items-center gap-[12px] rounded-[18px] bg-surface px-[12px] ' +
  'py-[10px] text-left desktop:gap-[10px] desktop:rounded-[14px] desktop:px-[10px] ' +
  'desktop:py-[8px]';

export const row: string =
  `${rowBase} transition-[box-shadow,background-color] duration-150 hover:shadow-card ` +
  'focus-visible:shadow-card aria-busy:opacity-70';

export const rowStatic: string = `${rowBase} cursor-default`;

export const rowAvatar: string =
  'h-[46px] w-[46px] text-2xl desktop:h-[37px] desktop:w-[37px] desktop:text-lg';

export const rowAvatarDot: string = 'h-[14px] w-[14px] border-2! desktop:h-[11px] desktop:w-[11px]';

export const roomAvatar: string =
  'flex size-[46px] shrink-0 items-center justify-center rounded-pill bg-primary-sky ' +
  'text-[20px] text-surface desktop:size-[37px] desktop:text-[16px]';

export const rowText: string = 'flex min-w-0 flex-1 flex-col gap-[4px] desktop:gap-[3px]';

export const rowName: string =
  'truncate text-xl leading-none font-bold text-text-ink desktop:text-[16px]';

export const rowSnippet: string =
  'truncate text-md leading-[1.15] font-regular text-text-gray desktop:text-[11px]';

export const rowSnippetUnread: string = 'font-bold text-text-ink';

export const rowSnippetMuted: string = 'text-text-muted';

export const rowSnippetError: string = 'text-accent-red';

export const rowMeta: string =
  'flex shrink-0 flex-col items-end gap-[6px] text-sm leading-none font-bold text-text-muted ' +
  'desktop:gap-[5px] desktop:text-[10px]';

export const rowBadge: string =
  'flex h-[20px] min-w-[20px] items-center justify-center rounded-pill bg-secondary-deep px-[6px] ' +
  'text-[12px] leading-none font-black text-surface tabular-nums desktop:h-[16px] ' +
  'desktop:min-w-[16px] desktop:px-[5px] desktop:text-[10px]';

export const rowLock: string = 'shrink-0 text-[20px] text-text-muted desktop:text-[16px]';

export const note: string =
  'px-[8px] py-[12px] text-center text-md leading-[1.35] font-regular text-text-muted ' +
  'desktop:text-[12px]';

export const noteAction: string =
  'ml-1 font-bold text-primary-sky underline-offset-2 hover:text-primary hover:underline';

export const skeletonRow: string =
  'h-[66px] shrink-0 rounded-[18px] bg-surface-sunken motion-safe:animate-pulse ' +
  'desktop:h-[53px] desktop:rounded-[14px]';

// ---- Conversation ----

export const peerButton: string =
  'flex min-w-0 flex-1 items-center gap-[12px] rounded-[14px] text-left desktop:gap-[10px] ' +
  'hover:[&_.peer-name]:underline focus-visible:[&_.peer-name]:underline';

export const peerAvatar: string =
  'h-[44px] w-[44px] text-2xl desktop:h-[35px] desktop:w-[35px] desktop:text-lg';

export const peerAvatarDot: string =
  'h-[13px] w-[13px] border-2! desktop:h-[10px] desktop:w-[10px]';

export const peerRoomAvatar: string =
  'flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-surface/25 ' +
  'text-[20px] text-surface desktop:size-[35px] desktop:text-[16px]';

export const peerText: string = 'flex min-w-0 flex-1 flex-col gap-[3px] desktop:gap-[2px]';

export const peerName: string =
  'peer-name truncate text-2xl leading-none font-bold text-surface underline-offset-2 ' +
  'desktop:text-[18px]';

export const peerStatus: string =
  'truncate text-md leading-none font-regular text-surface/80 desktop:text-[11px]';

export const messages: string =
  'relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-surface-raised ' +
  'px-[16px] py-[18px] desktop:px-[13px] desktop:py-[14px]';

export const messageStack: string = 'mt-auto flex flex-col gap-[12px] desktop:gap-[10px]';

export const dayDivider: string =
  'py-[2px] text-center text-sm leading-none font-bold tracking-[2px] text-text-muted ' +
  'desktop:text-[10px] desktop:tracking-[1.6px]';

export const incomingRow: string = 'flex flex-col items-start gap-[4px]';

export const outgoingRow: string = 'flex flex-col items-end gap-[4px]';

export const sender: string =
  'max-w-full truncate rounded-sm px-[4px] text-sm leading-none font-bold text-text-muted ' +
  'hover:text-text-ink hover:underline desktop:text-[10px]';

const bubbleBase: string =
  'max-w-[300px] px-[15px] py-[11px] text-lg leading-[1.25] font-regular whitespace-pre-wrap ' +
  '[overflow-wrap:anywhere] desktop:max-w-[240px] desktop:px-[12px] desktop:py-[9px] ' +
  'desktop:text-[14px]';

export const incomingBubble: string =
  `${bubbleBase} rounded-[18px] rounded-bl-[5px] bg-surface-muted text-text-ink ` +
  'desktop:rounded-[14px] desktop:rounded-bl-[4px]';

export const outgoingBubble: string =
  `${bubbleBase} rounded-[18px] rounded-br-[5px] bg-primary-sky text-surface ` +
  'desktop:rounded-[14px] desktop:rounded-br-[4px]';

export const pendingBubble: string = 'opacity-70';

export const failedBubble: string = 'bg-surface-sunken text-text-ink';

export const messageStatus: string =
  'flex flex-wrap items-center justify-end gap-x-[8px] px-[4px] text-sm leading-none ' +
  'font-regular text-text-muted desktop:text-[10px]';

export const messageStatusError: string = 'text-accent-red';

export const messageAction: string =
  'font-bold text-primary-sky underline-offset-2 hover:text-primary hover:underline';

export const olderSlot: string = 'flex min-h-[24px] shrink-0 items-center justify-center pb-[8px]';

export const threadNote: string =
  'm-auto max-w-[260px] py-[24px] text-center text-md leading-[1.35] font-regular ' +
  'text-text-muted desktop:text-[12px]';

export const newMessages: string =
  `${buttonInteraction} absolute bottom-[12px] left-1/2 z-10 -translate-x-1/2 rounded-pill ` +
  'bg-primary px-[14px] py-[7px] text-md leading-none font-bold text-surface shadow-soft ' +
  'hover:bg-primary-bright desktop:text-[11px]';

export const newMessagesSlot: string = 'pointer-events-none sticky bottom-0 h-0';

// ---- Composer ----

export const composer: string =
  'flex shrink-0 flex-col gap-[6px] bg-surface px-[14px] py-[12px] desktop:gap-[5px] ' +
  'desktop:px-[11px] desktop:py-[10px]';

export const composerRow: string = 'flex items-center gap-[10px] desktop:gap-[8px]';

export const composerInput: string =
  'h-[48px] min-w-0 flex-1 rounded-pill border-(length:--stroke-default) border-transparent ' +
  'bg-surface-muted px-[16px] text-lg font-regular text-text-ink outline-none ' +
  'placeholder:text-text-placeholder focus:border-primary-sky disabled:cursor-not-allowed ' +
  'disabled:opacity-60 desktop:h-[38px] desktop:px-[13px] desktop:text-[14px]';

export const send: string =
  `${buttonInteraction} inline-flex size-[48px] shrink-0 items-center justify-center ` +
  'rounded-pill bg-primary text-[20px] text-surface shadow-[0_3px_1px_var(--color-shadow-primary)] ' +
  'not-aria-disabled:hover:bg-primary-bright aria-disabled:opacity-50 desktop:size-[38px] ' +
  'desktop:text-[16px]';

export const composerNote: string =
  'px-[6px] text-sm leading-[1.3] font-regular text-text-muted desktop:text-[10px]';

export const composerNoteError: string = 'text-accent-red';

export const composerCount: string = 'ml-auto tabular-nums';

export const accessNotice: string =
  'flex shrink-0 flex-col items-center gap-[8px] bg-surface px-[18px] py-[16px] text-center ' +
  'text-md leading-[1.35] font-regular text-text-muted desktop:px-[14px] desktop:py-[12px] ' +
  'desktop:text-[12px]';
