import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import { useChatChannels, useChatPanel, useChatUnread } from '../hooks/useChat';
import { ChatThread } from './ChatThread';
import { ConversationList } from './ConversationList';
import * as styles from './ChatWidget.styles';

/** A person the chat shows, joined by the app layer from friends, the room and profiles. */
export interface ChatPerson {
  user_id: number;
  username: string;
  avatar_url: string | null;
  /** Left out where presence is unknown. */
  is_online?: boolean | undefined;
}

/** The room the user is in now, from its live snapshot. */
export interface ChatRoomContext {
  room_id: number;
  members: readonly ChatPerson[];
}

export interface ChatWidgetProps {
  /**
   * The screen underneath. Room Discovery shows the Chat pill on desktop, the Ready Room
   * and the Game the round button; in the Ready Room the open panel sits left of the Your
   * Setup sidebar so team, role, Ready and Leave stay usable.
   */
  place: 'LOBBY' | 'READY_ROOM' | 'GAME';
  selfUserId: number;
  friends: readonly ChatPerson[];
  friendsStatus: 'LOADING' | 'READY' | 'ERROR';
  room: ChatRoomContext | null;
  personById: (userId: number) => ChatPerson | null;
  onRetryFriends: () => void;
  onOpenProfile: (userId: number) => void;
}

const PANEL_ID = 'chat-panel';

/**
 * The chat widget: its launcher and, when open, the panel over the current screen.
 *
 * The app mounts it once for Room Discovery, the Ready Room and the Game, so closing the
 * panel or moving between those screens never drops the conversation: messages keep
 * arriving and count as unread while the panel is closed. The page underneath stays live
 * and usable; the panel does not block it.
 */
export function ChatWidget(props: ChatWidgetProps) {
  const { t } = useTranslation();
  const panel = useChatPanel();
  const unread = useChatUnread();
  const label =
    unread > 0 ? t('chat.launcher.labelUnread', { count: unread }) : t('chat.launcher.label');

  return (
    <>
      {props.place === 'LOBBY' ? (
        <button
          type="button"
          onClick={panel.toggle}
          aria-expanded={panel.isOpen}
          aria-controls={PANEL_ID}
          aria-label={label}
          data-chat-launcher
          className={styles.pill}
        >
          <Icon name="chat" className={styles.pillIcon} />
          {unread > 0 && (
            <span aria-hidden="true" className={styles.pillBadge}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          <span aria-hidden="true" className={styles.pillTitle}>
            {t('chat.launcher.title')}
          </span>
          <span aria-hidden="true" className={styles.pillCaption}>
            {unread > 0
              ? t('chat.launcher.caption', { count: unread })
              : t('chat.launcher.captionNone')}
          </span>
        </button>
      ) : (
        <RoundLauncher className={styles.roundFloating} />
      )}

      {panel.isOpen && <ChatPanel {...props} />}
    </>
  );
}

/**
 * The round chat button. Room Discovery puts it in its own header below desktop, where
 * the design draws it; the widget floats it in the corner of the Ready Room and the Game.
 */
export function ChatHeaderButton() {
  return <RoundLauncher className={styles.headerButton} />;
}

function RoundLauncher({ className }: { className: string }) {
  const { t } = useTranslation();
  const panel = useChatPanel();
  const unread = useChatUnread();
  return (
    <button
      type="button"
      onClick={panel.toggle}
      aria-expanded={panel.isOpen}
      aria-controls={PANEL_ID}
      aria-label={
        unread > 0 ? t('chat.launcher.labelUnread', { count: unread }) : t('chat.launcher.label')
      }
      data-chat-launcher
      className={cn(styles.round, className)}
    >
      <Icon name="chat" />
      {unread > 0 && (
        <span aria-hidden="true" className={styles.roundBadge}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

/** Is `element` laid out, i.e. not inside something hidden at this breakpoint? */
const isVisible = (element: HTMLElement): boolean => element.getClientRects().length > 0;

function ChatPanel({
  place,
  selfUserId,
  friends,
  friendsStatus,
  room,
  personById,
  onRetryFriends,
  onOpenProfile,
}: ChatWidgetProps) {
  const panel = useChatPanel();
  const { channels } = useChatChannels();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const { view } = panel;
  const channelId = view.kind === 'CHANNEL' && channels[view.channelId] ? view.channelId : null;

  // Focus moves into the panel when it opens or changes view, and back to a visible
  // launcher when it closes. On touch screens the panel itself takes focus, so opening it
  // does not pop the keyboard up over the conversation.
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const field = panelRef.current?.querySelector<HTMLElement>('[data-chat-autofocus]');
    (finePointer && field ? field : panelRef.current)?.focus({ preventScroll: true });
  }, [channelId]);

  useEffect(
    () => () => {
      const active = document.activeElement;
      if (active && active !== document.body && !panelRef.current?.contains(active)) return;
      const launcher = [...document.querySelectorAll<HTMLElement>('[data-chat-launcher]')].find(
        isVisible,
      );
      launcher?.focus();
    },
    [],
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    panel.close();
  };

  return (
    <section
      ref={panelRef}
      id={PANEL_ID}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        styles.panel,
        styles.panelMobileHeight,
        place === 'READY_ROOM' && styles.panelBesideSetup,
        'outline-none',
      )}
    >
      {channelId !== null ? (
        <ChatThread
          key={channelId}
          channelId={channelId}
          titleId={titleId}
          selfUserId={selfUserId}
          personById={personById}
          onBack={panel.showList}
          onClose={panel.close}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <ConversationList
          titleId={titleId}
          selfUserId={selfUserId}
          friends={friends}
          friendsStatus={friendsStatus}
          room={room}
          personById={personById}
          onRetryFriends={onRetryFriends}
          onOpenProfile={onOpenProfile}
          onClose={panel.close}
        />
      )}
    </section>
  );
}
