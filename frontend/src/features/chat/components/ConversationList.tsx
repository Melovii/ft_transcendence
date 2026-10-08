import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import { useChatChannels, useChatPanel } from '../hooks/useChat';
import type { ChatChannel, ChatTab } from '../store/chatStore';
import { MessageAge } from './MessageAge';
import type { ChatPerson, ChatRoomContext } from './ChatWidget';
import * as styles from './ChatWidget.styles';

interface ConversationListProps {
  titleId: string;
  selfUserId: number;
  friends: readonly ChatPerson[];
  friendsStatus: 'LOADING' | 'READY' | 'ERROR';
  room: ChatRoomContext | null;
  personById: (userId: number) => ChatPerson | null;
  onRetryFriends: () => void;
  onOpenProfile: (userId: number) => void;
  onClose: () => void;
}

/**
 * The CHATS list: the room's conversation and its players under Room, the user's friends
 * under Friends, filtered by the search field.
 *
 * Direct chats are friend-only, so a room player who is not a friend is shown locked, with
 * their profile — where Add Friend is — one press away. Every row comes from live state:
 * friends from the shared friend list, players from the room snapshot, previews and
 * unread counts from the chat store.
 */
export function ConversationList({
  titleId,
  selfUserId,
  friends,
  friendsStatus,
  room,
  personById,
  onRetryFriends,
  onOpenProfile,
  onClose,
}: ConversationListProps) {
  const { t } = useTranslation();
  const panel = useChatPanel();
  const chats = useChatChannels();
  const [query, setQuery] = useState('');
  const tabsId = useId();
  const tab: ChatTab = panel.tab ?? (room ? 'ROOM' : 'FRIENDS');

  const needle = query.trim().toLowerCase();
  const matches = (person: ChatPerson) => person.username.toLowerCase().includes(needle);

  const directByPeer = useMemo(() => {
    const map = new Map<number, ChatChannel>();
    for (const channel of Object.values(chats.channels)) {
      if (channel.type === 'DIRECT' && channel.peer && channel.access === 'ACTIVE') {
        map.set(channel.peer.user_id, channel);
      }
    }
    return map;
  }, [chats.channels]);

  const friendIds = new Set(friends.map((f) => f.user_id));

  // Most recent conversation first, then by name.
  const sortedFriends = [...friends].filter(matches).sort((a, b) => {
    const at = directByPeer.get(a.user_id)?.last_message?.sent_at ?? '';
    const bt = directByPeer.get(b.user_id)?.last_message?.sent_at ?? '';
    return bt.localeCompare(at) || a.username.localeCompare(b.username);
  });

  const roomChannel = room
    ? Object.values(chats.channels).find(
        (c) => c.type === 'ROOM' && c.room?.room_id === room.room_id,
      )
    : undefined;
  const members = room ? room.members.filter((m) => m.user_id !== selfUserId).filter(matches) : [];

  const personRow = (person: ChatPerson) => {
    if (!friendIds.has(person.user_id)) {
      return <LockedRow key={person.user_id} person={person} onOpenProfile={onOpenProfile} />;
    }
    const channel = directByPeer.get(person.user_id);
    return (
      <ConversationRow
        key={person.user_id}
        avatar={
          <Avatar
            src={person.avatar_url ?? undefined}
            name=""
            online={person.is_online}
            sizeClassName={styles.rowAvatar}
            dotClassName={styles.rowAvatarDot}
          />
        }
        name={person.username}
        presence={
          person.is_online === undefined
            ? undefined
            : t(person.is_online ? 'chat.presence.online' : 'chat.presence.offline')
        }
        channel={channel}
        unread={channel ? (chats.unread[channel.channel_id] ?? 0) : 0}
        selfUserId={selfUserId}
        personById={personById}
        busy={chats.openingPeerId === person.user_id}
        failed={chats.openFailedPeerId === person.user_id}
        onOpen={() =>
          channel ? chats.openChannel(channel.channel_id) : chats.openDirect(person.user_id)
        }
      />
    );
  };

  return (
    <>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.headerTitle}>
          {t('chat.panel.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('chat.panel.close')}
          className={styles.headerIconButton}
        >
          <Icon name="close" />
        </button>
      </header>

      <div className={styles.listBody}>
        <label className={styles.search}>
          <span className="sr-only">{t('chat.search.label')}</span>
          <Icon name="search" className={styles.searchIcon} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('chat.search.placeholder')}
            autoComplete="off"
            data-chat-autofocus
            className={styles.searchInput}
          />
        </label>

        <div role="tablist" aria-label={t('chat.tabs.label')} className={styles.tabs}>
          {(['ROOM', 'FRIENDS'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${tabsId}-${value}`}
              aria-selected={tab === value}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => panel.setTab(value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = value === 'ROOM' ? 'FRIENDS' : 'ROOM';
                  panel.setTab(next);
                  document.getElementById(`${tabsId}-${next}`)?.focus();
                }
              }}
              className={styles.tab}
            >
              {t(`chat.tabs.${value}`)}
              {tab === value && <span aria-hidden="true" className={styles.tabIndicator} />}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${tabsId}-panel`}
          aria-labelledby={`${tabsId}-${tab}`}
          className="flex flex-col gap-[12px] desktop:gap-[10px]"
        >
          {chats.status === 'ERROR' && (
            <p role="alert" className={styles.note}>
              {t('chat.list.channelsError')}
              <button type="button" onClick={chats.retry} className={styles.noteAction}>
                {t('chat.retry')}
              </button>
            </p>
          )}

          {tab === 'ROOM' &&
            (room ? (
              <>
                <h3 className={styles.sectionLabel}>{t('chat.sections.room')}</h3>
                <ul className={styles.rows}>
                  {!needle && (
                    <li>
                      <RoomChannelRow
                        channel={roomChannel}
                        listReady={chats.status === 'READY'}
                        unread={roomChannel ? (chats.unread[roomChannel.channel_id] ?? 0) : 0}
                        selfUserId={selfUserId}
                        personById={personById}
                        onOpen={chats.openChannel}
                      />
                    </li>
                  )}
                  {members.map((member) => (
                    <li key={member.user_id}>{personRow(member)}</li>
                  ))}
                </ul>
                {needle && members.length === 0 && (
                  <p className={styles.note}>{t('chat.list.noResults', { query: query.trim() })}</p>
                )}
              </>
            ) : (
              <p className={styles.note}>{t('chat.list.noRoom')}</p>
            ))}

          {tab === 'FRIENDS' && (
            <>
              <h3 className={styles.sectionLabel}>{t('chat.sections.friends')}</h3>
              {friendsStatus === 'LOADING' && friends.length === 0 ? (
                <div role="status" aria-label={t('chat.list.loading')} className={styles.rows}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} aria-hidden="true" className={styles.skeletonRow} />
                  ))}
                </div>
              ) : friendsStatus === 'ERROR' && friends.length === 0 ? (
                <p role="alert" className={styles.note}>
                  {t('chat.list.friendsError')}
                  <button type="button" onClick={onRetryFriends} className={styles.noteAction}>
                    {t('chat.retry')}
                  </button>
                </p>
              ) : friends.length === 0 ? (
                <p className={styles.note}>{t('chat.list.noFriends')}</p>
              ) : sortedFriends.length === 0 ? (
                <p className={styles.note}>{t('chat.list.noResults', { query: query.trim() })}</p>
              ) : (
                <ul className={styles.rows}>
                  {sortedFriends.map((friend) => (
                    <li key={friend.user_id}>{personRow(friend)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** The preview line of a conversation: its newest message, marked when it is the user's. */
function usePreview(
  channel: ChatChannel | undefined,
  selfUserId: number,
  personById: (userId: number) => ChatPerson | null,
  isRoom: boolean,
): string | null {
  const { t } = useTranslation();
  const last = channel?.last_message;
  if (!last) return null;
  if (last.sender_user_id === selfUserId) return t('chat.list.fromYou', { text: last.text });
  if (!isRoom) return last.text;
  const name = personById(last.sender_user_id)?.username ?? t('chat.unknownPlayer');
  return t('chat.list.fromPlayer', { name, text: last.text });
}

function ConversationRow({
  avatar,
  name,
  presence,
  channel,
  unread,
  selfUserId,
  personById,
  busy = false,
  failed = false,
  isRoom = false,
  onOpen,
}: {
  avatar: ReactNode;
  name: string;
  presence?: string | undefined;
  channel: ChatChannel | undefined;
  unread: number;
  selfUserId: number;
  personById: (userId: number) => ChatPerson | null;
  busy?: boolean;
  failed?: boolean;
  isRoom?: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const preview = usePreview(channel, selfUserId, personById, isRoom);
  const last = channel?.last_message;

  return (
    <button type="button" onClick={onOpen} aria-busy={busy} className={styles.row}>
      {avatar}
      <span className={styles.rowText}>
        <span className={styles.rowName}>
          {name}
          {presence && <span className="sr-only">, {presence}</span>}
        </span>
        <span
          className={cn(
            styles.rowSnippet,
            unread > 0 && styles.rowSnippetUnread,
            !preview && styles.rowSnippetMuted,
            failed && styles.rowSnippetError,
          )}
        >
          {failed
            ? t('chat.list.openFailed')
            : busy
              ? t('chat.list.opening')
              : (preview ?? t('chat.list.noMessages'))}
        </span>
      </span>
      {(last || unread > 0) && (
        <span className={styles.rowMeta}>
          {last && <MessageAge iso={last.sent_at} />}
          {unread > 0 && (
            <span className={styles.rowBadge}>
              <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
              <span className="sr-only">{t('chat.list.unread', { count: unread })}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function RoomChannelRow({
  channel,
  listReady,
  unread,
  selfUserId,
  personById,
  onOpen,
}: {
  channel: ChatChannel | undefined;
  listReady: boolean;
  unread: number;
  selfUserId: number;
  personById: (userId: number) => ChatPerson | null;
  onOpen: (channelId: number) => void;
}) {
  const { t } = useTranslation();
  const avatar = (
    <span aria-hidden="true" className={styles.roomAvatar}>
      <Icon name="team" />
    </span>
  );

  if (channel?.access === 'ACTIVE') {
    return (
      <ConversationRow
        avatar={avatar}
        name={t('chat.room.name')}
        channel={channel}
        unread={unread}
        selfUserId={selfUserId}
        personById={personById}
        isRoom
        onOpen={() => onOpen(channel.channel_id)}
      />
    );
  }

  // Not usable now: the channel is still being provisioned, or access ended.
  return (
    <div className={styles.rowStatic}>
      {avatar}
      <span className={styles.rowText}>
        <span className={styles.rowName}>{t('chat.room.name')}</span>
        <span className={cn(styles.rowSnippet, styles.rowSnippetMuted)}>
          {channel
            ? t('chat.room.closed')
            : listReady
              ? t('chat.room.preparing')
              : t('chat.list.loading')}
        </span>
      </span>
    </div>
  );
}

function LockedRow({
  person,
  onOpenProfile,
}: {
  person: ChatPerson;
  onOpenProfile: (userId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(person.user_id)}
      aria-haspopup="dialog"
      className={styles.row}
    >
      <Avatar
        src={person.avatar_url ?? undefined}
        name=""
        sizeClassName={styles.rowAvatar}
        dotClassName={styles.rowAvatarDot}
      />
      <span className={styles.rowText}>
        <span className={styles.rowName}>{person.username}</span>
        <span className={cn(styles.rowSnippet, styles.rowSnippetMuted)}>
          {t('chat.list.addFriend')}
        </span>
      </span>
      <Icon name="lock" className={styles.rowLock} />
    </button>
  );
}
