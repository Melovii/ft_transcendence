import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { openProfileModal } from '@shared/stores';
import type { Friend } from '@shared/types';
import { AvatarImage, Icon, LoadingDots } from '@shared/ui';
import type { IconName } from '@shared/ui';
import { cn } from '@shared/utils';

import { useFriendRequests } from '../hooks/useFriendRequests';
import { useOnlineFriends } from '../hooks/useOnlineFriends';
import { useFriendsStore } from '../store/friendsStore';
import { FriendsDialog } from './FriendsDialog';
import { openButton, openCount, requestCount } from './FriendsDialog.styles';
import * as styles from './OnlinePlayers.styles';

/** Cards the desktop row shows before Show More. */
const DESKTOP_VISIBLE = 4;

/** Placeholder cards while the list loads. */
const SKELETON_COUNT = 4;

export interface OnlinePlayersProps {
  /** The empty state's Invite Friends action. */
  onInvite: () => void;
  className?: string;
}

/**
 * Players Online in Room Discovery: the user's friends who are online now. A card opens
 * that player's profile over the page.
 *
 * Loading shows placeholder cards and the loading ring beside the heading, so the section
 * keeps its place; an empty list says so and offers Invite Friends, and a failed load says
 * so and offers Try again. Desktop shows four cards and Show More; mobile and tablet scroll
 * the whole row sideways. Friends, beside the heading, opens the whole friend list and the
 * username search.
 */
export function OnlinePlayers({ onInvite, className }: OnlinePlayersProps) {
  const { t } = useTranslation();
  const id = useId();
  const { online, status, retry } = useOnlineFriends();
  const [expanded, setExpanded] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const friendCount = useFriendsStore((state) => state.friendCount);
  // Requests waiting for an answer are announced on the Friends button.
  const { incoming } = useFriendRequests();
  const loading = status === 'LOADING';

  return (
    <section aria-labelledby={`${id}-title`} aria-busy={loading} className={className}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`} className={styles.title}>
          {t('lobby.players.title')}
        </h2>
        {loading && <LoadingDots label={t('lobby.players.loading')} className={styles.loader} />}
        <button
          type="button"
          onClick={() => setFriendsOpen(true)}
          aria-haspopup="dialog"
          aria-label={
            status === 'READY'
              ? t('friends.openLabel', { count: friendCount }) +
                (incoming.length > 0
                  ? ` ${t('friends.requests.waiting', { count: incoming.length })}`
                  : '')
              : t('friends.title')
          }
          className={cn(openButton, styles.friendsButton)}
        >
          <Icon name="team" />
          {t('friends.title')}
          {status === 'READY' && (
            <span aria-hidden="true" className={openCount}>
              {friendCount}
            </span>
          )}
          {incoming.length > 0 && (
            <span aria-hidden="true" className={requestCount}>
              +{incoming.length}
            </span>
          )}
        </button>
      </div>

      {loading && (
        <ul aria-hidden="true" className={styles.row}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <li key={index} className={cn(styles.card, styles.skeletonCard)}>
              <span className={styles.skeletonAvatar} />
              <span className={styles.skeletonName} />
              <span className={styles.skeletonStatus} />
            </li>
          ))}
        </ul>
      )}

      {status === 'ERROR' && (
        <Notice
          icon="disconnected"
          title={t('lobby.players.errorTitle')}
          body={t('lobby.players.errorBody')}
          action={t('common.retry')}
          actionIcon="history"
          onAction={() => void retry()}
          alert
        />
      )}

      {status === 'READY' && online.length === 0 && (
        <Notice
          icon="playersOff"
          title={t('lobby.players.emptyTitle')}
          body={t('lobby.players.emptyBody')}
          action={t('lobby.players.invite')}
          actionIcon="userAdd"
          onAction={onInvite}
        />
      )}

      {status === 'READY' && online.length > 0 && (
        <ul className={cn(styles.row, expanded && styles.rowExpanded)}>
          {online.map((friend, index) => (
            <li
              key={friend.user_id}
              className={cn(!expanded && index >= DESKTOP_VISIBLE && styles.desktopOverflow)}
            >
              <PlayerCard friend={friend} />
            </li>
          ))}
          {!expanded && online.length > DESKTOP_VISIBLE && (
            <li className={styles.showMoreItem}>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={t('lobby.players.showMoreLabel', {
                  count: online.length - DESKTOP_VISIBLE,
                })}
                className={styles.showMore}
              >
                {t('lobby.players.showMore')}
              </button>
            </li>
          )}
        </ul>
      )}

      {friendsOpen && <FriendsDialog onClose={() => setFriendsOpen(false)} />}
    </section>
  );
}

function PlayerCard({ friend }: { friend: Friend }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => openProfileModal(friend.user_id)}
      aria-haspopup="dialog"
      aria-label={t('lobby.players.openProfile', { username: friend.username })}
      className={cn(styles.card, styles.playerCard)}
    >
      <span className={styles.avatar}>
        <AvatarImage
          src={friend.avatar_url}
          className={styles.avatarImage}
          placeholderClassName={styles.avatarPlaceholder}
        />
      </span>
      <span className={styles.name}>{friend.username}</span>
      <span className={styles.badge}>
        <span aria-hidden="true" className={styles.badgeDot} />
        {t('lobby.players.online')}
      </span>
    </button>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
  actionIcon,
  onAction,
  alert = false,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: string;
  actionIcon: IconName;
  onAction: () => void;
  alert?: boolean;
}) {
  return (
    <div role={alert ? 'alert' : undefined} className={styles.notice}>
      <Icon name={icon} className={styles.noticeIcon} />
      <div className={styles.noticeCopy}>
        <p className={styles.noticeTitle}>{title}</p>
        <p className={styles.noticeBody}>{body}</p>
      </div>
      <button type="button" onClick={onAction} className={styles.noticeAction}>
        <Icon name={actionIcon} />
        {action}
      </button>
    </div>
  );
}
