import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { CHAT_MESSAGE_MAX_LENGTH } from '@shared/types';
import type { ChatMessage } from '@shared/types';
import { Avatar, Icon, Skeleton } from '@shared/ui';
import { cn } from '@shared/utils';

import { useConversation } from '../hooks/useChat';
import { dayKey, dayLabel, messageLength, sendableText } from '../model/messages';
import type { ChatChannel, PendingMessage } from '../store/chatStore';
import type { ChatPerson } from './ChatWidget';
import * as styles from './ChatWidget.styles';

interface ChatThreadProps {
  channelId: number;
  titleId: string;
  selfUserId: number;
  personById: (userId: number) => ChatPerson | null;
  onBack: () => void;
  onClose: () => void;
  onOpenProfile: (userId: number) => void;
}

/** Scrolled within this distance of the end counts as reading the newest messages. */
const NEAR_BOTTOM_PX = 80;

/** Unsent drafts per conversation, kept while the tab lives so switching chats loses nothing. */
const drafts = new Map<number, string>();

/**
 * One conversation: a direct chat with a friend or the room's chat. Messages are shown in
 * the server's order, grouped by day; the user's own are on the right. A message still
 * waiting for its ack shows as sending, and one that could not be sent stays on screen
 * with the reason and, when the server allows it, Retry — it is never silently lost.
 *
 * Text is rendered as text, never as markup.
 */
export function ChatThread({
  channelId,
  titleId,
  selfUserId,
  personById,
  onBack,
  onClose,
  onOpenProfile,
}: ChatThreadProps) {
  const conversation = useConversation(channelId);
  const { channel, markSeen } = conversation;

  useEffect(() => {
    markSeen();
    const onVisible = () => markSeen();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markSeen]);

  if (!channel) return null;

  return (
    <>
      <ThreadHeader
        channel={channel}
        titleId={titleId}
        personById={personById}
        onBack={onBack}
        onClose={onClose}
        onOpenProfile={onOpenProfile}
      />
      <MessageList
        channel={channel}
        conversation={conversation}
        selfUserId={selfUserId}
        personById={personById}
        onOpenProfile={onOpenProfile}
      />
      {channel.access === 'ACTIVE' ? (
        <Composer channelId={channelId} conversation={conversation} />
      ) : channel.access === 'READ_ONLY' ? (
        <ReadOnlyNotice />
      ) : (
        <AccessNotice channel={channel} onOpenProfile={onOpenProfile} />
      )}
    </>
  );
}

type Conversation = ReturnType<typeof useConversation>;

function ThreadHeader({
  channel,
  titleId,
  personById,
  onBack,
  onClose,
  onOpenProfile,
}: {
  channel: ChatChannel;
  titleId: string;
  personById: (userId: number) => ChatPerson | null;
  onBack: () => void;
  onClose: () => void;
  onOpenProfile: (userId: number) => void;
}) {
  const { t } = useTranslation();
  const peer = channel.peer;
  // The friend list carries fresher presence and avatar than the channel's summary.
  const live = peer ? personById(peer.user_id) : null;
  const online = live?.is_online ?? peer?.is_online;
  const avatarUrl = live?.avatar_url ?? peer?.avatar_url ?? null;

  return (
    <header className={styles.threadHeader}>
      <button
        type="button"
        onClick={onBack}
        aria-label={t('chat.panel.back')}
        className={styles.headerIconButton}
      >
        <Icon name="back" />
      </button>

      {peer ? (
        <button
          type="button"
          onClick={() => onOpenProfile(peer.user_id)}
          aria-haspopup="dialog"
          className={styles.peerButton}
        >
          <Avatar
            src={avatarUrl ?? undefined}
            name=""
            online={online}
            sizeClassName={styles.peerAvatar}
            dotClassName={styles.peerAvatarDot}
          />
          <span className={styles.peerText}>
            <span id={titleId} className={styles.peerName}>
              {live?.username ?? peer.username}
            </span>
            {online !== undefined && (
              <span className={styles.peerStatus}>
                {t(online ? 'chat.presence.online' : 'chat.presence.offline')}
              </span>
            )}
          </span>
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-[12px] desktop:gap-[10px]">
          <span aria-hidden="true" className={styles.peerRoomAvatar}>
            <Icon name="team" />
          </span>
          <span className={styles.peerText}>
            <span id={titleId} className={styles.peerName}>
              {t('chat.room.name')}
            </span>
            {channel.room?.room_code && (
              <span className={styles.peerStatus}>
                {t('chat.room.code', { code: channel.room.room_code })}
              </span>
            )}
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label={t('chat.panel.close')}
        className={styles.headerIconButton}
      >
        <Icon name="close" />
      </button>
    </header>
  );
}

type Item =
  | { kind: 'DAY'; key: string; iso: string }
  | { kind: 'MESSAGE'; key: string; message: ChatMessage; own: boolean; showSender: boolean }
  | { kind: 'PENDING'; key: string; pending: PendingMessage };

/** Messages and pending sends in display order, with a divider at each new day. */
function buildItems(
  messages: readonly ChatMessage[],
  pending: readonly PendingMessage[],
  selfUserId: number,
  isRoom: boolean,
): Item[] {
  const items: Item[] = [];
  let lastDay: string | null = null;
  let lastSender: number | null = null;
  const addDay = (iso: string) => {
    const day = dayKey(iso);
    if (day === lastDay) return;
    lastDay = day;
    lastSender = null;
    items.push({ kind: 'DAY', key: `day-${day}`, iso });
  };
  for (const message of messages) {
    addDay(message.sent_at);
    const own = message.sender_user_id === selfUserId;
    items.push({
      kind: 'MESSAGE',
      key: message.message_id,
      message,
      own,
      showSender: isRoom && !own && message.sender_user_id !== lastSender,
    });
    lastSender = message.sender_user_id;
  }
  for (const entry of pending) {
    addDay(entry.created_at);
    items.push({ kind: 'PENDING', key: entry.request_id, pending: entry });
    lastSender = selfUserId;
  }
  return items;
}

function MessageList({
  channel,
  conversation,
  selfUserId,
  personById,
  onOpenProfile,
}: {
  channel: ChatChannel;
  conversation: Conversation;
  selfUserId: number;
  personById: (userId: number) => ChatPerson | null;
  onOpenProfile: (userId: number) => void;
}) {
  const { t } = useTranslation();
  const { history, pending, loadOlder, reload } = conversation;
  const isRoom = channel.type === 'ROOM';
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const edges = useRef<{ first?: string | undefined; last?: string | undefined; height: number }>({
    height: 0,
  });
  const [showNew, setShowNew] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const ready = history?.status === 'READY';
  const items = ready ? buildItems(history.messages, pending, selfUserId, isRoom) : [];
  const firstKey = items.find((i) => i.kind !== 'DAY')?.key;
  const lastItem = items.at(-1);
  const lastKey = lastItem?.key;

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    nearBottom.current = true;
    setShowNew(false);
  }, []);

  // Keep the reader where they are: at the end when they were there or just sent something,
  // in place when older messages are added above, and otherwise offer New messages.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const previous = edges.current;
    if (previous.first && firstKey !== previous.first && lastKey === previous.last) {
      list.scrollTop += list.scrollHeight - previous.height;
    } else if (lastKey !== previous.last) {
      const ownNewest =
        lastItem?.kind === 'PENDING' || (lastItem?.kind === 'MESSAGE' && lastItem.own);
      if (previous.last === undefined || nearBottom.current || ownNewest) {
        list.scrollTop = list.scrollHeight;
        nearBottom.current = true;
      } else if (lastItem?.kind === 'MESSAGE') {
        setShowNew(true);
      }
      if (previous.last !== undefined && lastItem?.kind === 'MESSAGE' && !lastItem.own) {
        const name = personById(lastItem.message.sender_user_id)?.username;
        setAnnouncement(name ? t('chat.thread.newFrom', { name }) : t('chat.thread.newMessage'));
      }
    }
    edges.current = { first: firstKey, last: lastKey, height: list.scrollHeight };
    // `lastItem` is rebuilt on every render, so this runs after each one and always
    // measures the current height.
  }, [firstKey, lastKey, lastItem, personById, t]);

  // The phone keyboard or a resize shrinks the list: stay at the end if that is where the
  // reader was.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // Older messages page in as the reader reaches the top.
  const hasOlder = ready && history.cursor !== null;
  useEffect(() => {
    const list = listRef.current;
    const top = topRef.current;
    if (!list || !top || !hasOlder) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadOlder();
      },
      { root: list, rootMargin: '120px 0px 0px 0px' },
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [hasOlder, loadOlder, firstKey]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom.current) setShowNew(false);
  };

  return (
    <div
      ref={listRef}
      onScroll={onScroll}
      tabIndex={0}
      aria-label={t('chat.thread.label')}
      className={styles.messages}
    >
      {history?.status === 'LOADING' || !history ? (
        <div role="status" aria-label={t('chat.thread.loading')} className={styles.messageStack}>
          <Skeleton className="h-[42px] w-3/5 rounded-[18px]" />
          <Skeleton className="ml-auto h-[42px] w-1/2 rounded-[18px]" />
          <Skeleton className="h-[42px] w-2/3 rounded-[18px]" />
        </div>
      ) : history.status === 'ERROR' ? (
        <p role="alert" className={styles.threadNote}>
          {t('chat.thread.error')}
          <button type="button" onClick={reload} className={styles.noteAction}>
            {t('chat.retry')}
          </button>
        </p>
      ) : (
        <>
          <div ref={topRef} className={styles.olderSlot}>
            {history.loadingOlder && (
              <span role="status" className={styles.messageStatus}>
                {t('chat.thread.olderLoading')}
              </span>
            )}
            {history.olderFailed && (
              <span className={cn(styles.messageStatus, styles.messageStatusError)}>
                {t('chat.thread.olderFailed')}
                <button type="button" onClick={loadOlder} className={styles.messageAction}>
                  {t('chat.retry')}
                </button>
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <p className={styles.threadNote}>
              {t(isRoom ? 'chat.thread.emptyRoom' : 'chat.thread.empty')}
            </p>
          ) : (
            <ol className={styles.messageStack}>
              {items.map((item) => (
                <li key={item.key}>
                  {item.kind === 'DAY' ? (
                    <DayDivider iso={item.iso} />
                  ) : item.kind === 'MESSAGE' ? (
                    <MessageBubble
                      message={item.message}
                      own={item.own}
                      sender={
                        item.showSender
                          ? (personById(item.message.sender_user_id)?.username ??
                            t('chat.unknownPlayer'))
                          : null
                      }
                      onOpenProfile={onOpenProfile}
                    />
                  ) : (
                    <PendingBubble pending={item.pending} conversation={conversation} />
                  )}
                </li>
              ))}
            </ol>
          )}

          {showNew && (
            <div className={styles.newMessagesSlot}>
              <button
                type="button"
                onClick={scrollToEnd}
                className={cn(styles.newMessages, 'pointer-events-auto')}
              >
                {t('chat.thread.newMessages')}
                <Icon name="chevronDown" className="ml-[6px]" />
              </button>
            </div>
          )}
        </>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  const { t, i18n } = useTranslation();
  const label = dayLabel(iso);
  return (
    <p className={styles.dayDivider}>
      {label.kind === 'TODAY'
        ? t('chat.day.today')
        : label.kind === 'YESTERDAY'
          ? t('chat.day.yesterday')
          : new Intl.DateTimeFormat(i18n.language, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }).format(label.date)}
    </p>
  );
}

function useTimeLabel(iso: string): string {
  const { i18n } = useTranslation();
  return new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

function MessageBubble({
  message,
  own,
  sender,
  onOpenProfile,
}: {
  message: ChatMessage;
  own: boolean;
  sender: string | null;
  onOpenProfile: (userId: number) => void;
}) {
  const { t } = useTranslation();
  const time = useTimeLabel(message.sent_at);
  return (
    <div className={own ? styles.outgoingRow : styles.incomingRow}>
      {sender !== null && (
        <button
          type="button"
          onClick={() => onOpenProfile(message.sender_user_id)}
          aria-haspopup="dialog"
          className={styles.sender}
        >
          {sender}
        </button>
      )}
      <p title={time} className={own ? styles.outgoingBubble : styles.incomingBubble}>
        <span className="sr-only">{own ? t('chat.thread.you') : (sender ?? '')} </span>
        {message.text}
        <span className="sr-only">
          {' '}
          <time dateTime={message.sent_at}>{time}</time>
        </span>
      </p>
    </div>
  );
}

function PendingBubble({
  pending,
  conversation,
}: {
  pending: PendingMessage;
  conversation: Conversation;
}) {
  const { t } = useTranslation();
  const failed = pending.status === 'FAILED';
  const retryable =
    failed &&
    (pending.failure === 'OFFLINE' ||
      pending.failure === 'TIMEOUT' ||
      pending.failure === 'UNAVAILABLE' ||
      // Refused during the match: it can go again once chat reopens.
      (pending.failure === 'READ_ONLY' && conversation.channel?.access === 'ACTIVE'));

  return (
    <div className={styles.outgoingRow}>
      <p className={cn(styles.outgoingBubble, failed ? styles.failedBubble : styles.pendingBubble)}>
        {pending.text}
      </p>
      <p
        role={failed ? 'alert' : undefined}
        className={cn(styles.messageStatus, failed && styles.messageStatusError)}
      >
        {failed
          ? t(`chat.pending.failed.${pending.failure ?? 'INVALID'}`)
          : t('chat.pending.sending')}
        {retryable && (
          <button
            type="button"
            onClick={() => conversation.retry(pending.request_id)}
            disabled={!conversation.online}
            className={cn(styles.messageAction, 'disabled:text-text-muted disabled:no-underline')}
          >
            {t('chat.pending.retry')}
          </button>
        )}
        {failed && (
          <button
            type="button"
            onClick={() => conversation.discard(pending.request_id)}
            className={styles.messageAction}
          >
            {t('chat.pending.discard')}
          </button>
        )}
      </p>
    </div>
  );
}

function Composer({ channelId, conversation }: { channelId: number; conversation: Conversation }) {
  const { t } = useTranslation();
  const inputId = useId();
  const noteId = useId();
  const [draft, setDraft] = useState(() => drafts.get(channelId) ?? '');
  const length = messageLength(draft.trim());
  const tooLong = length > CHAT_MESSAGE_MAX_LENGTH;
  const canSend = conversation.online && sendableText(draft) !== null;

  const update = (value: string) => {
    setDraft(value);
    if (value) drafts.set(channelId, value);
    else drafts.delete(channelId);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    // The message lives on as a pending bubble until the ack, with Retry if it fails, so
    // clearing the field here loses nothing.
    if (conversation.send(draft)) update('');
  };

  // Typing here never reaches page-level shortcuts such as the game's. Escape still goes
  // up to the panel, which closes.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') event.stopPropagation();
  };

  const note = !conversation.online
    ? t('chat.composer.offline')
    : tooLong
      ? t('chat.composer.tooLong', { max: CHAT_MESSAGE_MAX_LENGTH })
      : null;

  return (
    <form onSubmit={submit} className={styles.composer}>
      <div className={styles.composerRow}>
        <label htmlFor={inputId} className="sr-only">
          {t('chat.composer.label')}
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(event) => update(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('chat.composer.placeholder')}
          autoComplete="off"
          enterKeyHint="send"
          aria-invalid={tooLong}
          aria-describedby={noteId}
          data-chat-autofocus
          className={styles.composerInput}
        />
        <button
          type="submit"
          aria-disabled={!canSend}
          aria-label={t('chat.composer.send')}
          className={styles.send}
        >
          <Icon name="send" />
        </button>
      </div>
      <p
        id={noteId}
        aria-live="polite"
        className={cn(
          styles.composerNote,
          'flex empty:hidden',
          tooLong && styles.composerNoteError,
        )}
      >
        {note}
        {length > CHAT_MESSAGE_MAX_LENGTH - 50 && (
          <span className={styles.composerCount}>
            {t('chat.composer.count', { count: length, max: CHAT_MESSAGE_MAX_LENGTH })}
          </span>
        )}
      </p>
    </form>
  );
}

/**
 * In place of the composer while the user's match runs: messages stay readable, sending
 * waits until the match pauses or ends. The server says when either happens.
 */
function ReadOnlyNotice() {
  const { t } = useTranslation();
  return (
    <div role="status" className={styles.accessNotice}>
      <Icon name="timer" className="text-[20px] desktop:text-[16px]" />
      <p>{t('chat.access.gameRunning')}</p>
    </div>
  );
}

function AccessNotice({
  channel,
  onOpenProfile,
}: {
  channel: ChatChannel;
  onOpenProfile: (userId: number) => void;
}) {
  const { t } = useTranslation();
  const peer = channel.peer;
  const text =
    channel.type === 'DIRECT'
      ? t('chat.access.direct')
      : t(`chat.access.room.${channel.reason ?? 'default'}`, {
          defaultValue: t('chat.access.room.default'),
        });
  return (
    <div role="status" className={styles.accessNotice}>
      <Icon name="lock" className="text-[20px] desktop:text-[16px]" />
      <p>{text}</p>
      {peer && (
        <button
          type="button"
          onClick={() => onOpenProfile(peer.user_id)}
          aria-haspopup="dialog"
          className={styles.noteAction}
        >
          {t('chat.access.viewProfile')}
        </button>
      )}
    </div>
  );
}
