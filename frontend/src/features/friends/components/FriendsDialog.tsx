import { useId } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { openProfileModal, useModalStore } from '@shared/stores';
import { USER_SEARCH_QUERY } from '@shared/types';
import type { Friend, UserSearchResult } from '@shared/types';
import { AvatarImage, Button, Dialog, Icon, LoadingDots } from '@shared/ui';
import type { IconName } from '@shared/ui';

import { useAddFriend } from '../hooks/useAddFriend';
import { useFriendList } from '../hooks/useFriendList';
import { useUserSearch } from '../hooks/useUserSearch';
import { useFriendsStore } from '../store/friendsStore';
import * as styles from './FriendsDialog.styles';

export interface FriendsDialogProps {
  onClose: () => void;
}

/**
 * Friends, over Room Discovery: the user's whole friend list with live presence, and a
 * username search to find someone new.
 *
 * Friendship is immediate and mutual, so there are no requests to accept and nothing is
 * pending: Add Friend makes the friendship at once, and the count and the list follow the
 * server's answer. A name in either list opens that player's profile over this dialog,
 * where the friendship can also be ended; this dialog waits underneath until it closes.
 *
 * Presence (`is_online`) is what the server reports on the latest read of the list; the
 * list is read again when the dialog opens and after a reconnect.
 */
export function FriendsDialog({ onClose }: FriendsDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const friendCount = useFriendsStore((state) => state.friendCount);
  // A profile opened from here stands over this dialog; Escape then belongs to it.
  const profileOpen = useModalStore((state) => state.active !== null);
  const list = useFriendList();
  const search = useUserSearch();
  const additions = useAddFriend();

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-subtitle`}
      closeLabel={t('common.close')}
      onClose={onClose}
      closable={!profileOpen}
      className={styles.card}
    >
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>
          {t('friends.title')}
        </h2>
        <p id={`${id}-subtitle`} className={styles.subtitle}>
          {list.status === 'READY'
            ? t('friends.count', { count: friendCount })
            : t('friends.subtitle')}
        </p>
      </header>

      <div className="flex flex-col gap-[6px]">
        <label className={styles.search}>
          <span className="sr-only">{t('friends.search.label')}</span>
          <Icon name="search" className={styles.searchIcon} />
          <input
            type="search"
            value={search.input}
            onChange={(event) => search.setInput(event.target.value)}
            maxLength={USER_SEARCH_QUERY.maxLength}
            placeholder={t('friends.search.placeholder')}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-search-hint`}
            className={styles.searchInput}
          />
        </label>
        <p id={`${id}-search-hint`} className={styles.hint}>
          {t('friends.search.hint', { max: USER_SEARCH_QUERY.maxLength })}
        </p>
      </div>

      {search.term === null ? (
        <FriendList list={list} titleId={`${id}-friends`} />
      ) : (
        <SearchResults search={search} additions={additions} titleId={`${id}-results`} />
      )}
    </Dialog>
  );
}

function FriendList({
  list,
  titleId,
}: {
  list: ReturnType<typeof useFriendList>;
  titleId: string;
}) {
  const { t } = useTranslation();
  // Online friends first; each group keeps the server's username order.
  const friends = [...list.friends].sort((a, b) => Number(b.is_online) - Number(a.is_online));

  return (
    <section aria-labelledby={titleId} aria-busy={list.status === 'LOADING'}>
      <h3 id={titleId} className="sr-only">
        {t('friends.listTitle')}
      </h3>
      {list.status === 'LOADING' && <Loading label={t('friends.loading')} />}
      {list.status === 'ERROR' && (
        <State
          icon="disconnected"
          title={t('friends.errorTitle')}
          body={t('friends.errorBody')}
          action={{ label: t('common.retry'), icon: 'history', onClick: list.retry }}
          alert
        />
      )}
      {list.status === 'READY' && friends.length === 0 && (
        <State icon="playersOff" title={t('friends.emptyTitle')} body={t('friends.emptyBody')} />
      )}
      {list.status === 'READY' && friends.length > 0 && (
        <ul className={styles.list}>
          {friends.map((friend) => (
            <li key={friend.user_id} className={styles.row}>
              <PlayerIdentity player={friend}>
                <span className={friend.is_online ? styles.badgeOnline : styles.badgeOffline}>
                  <span aria-hidden="true" className={styles.badgeDot} />
                  {t(friend.is_online ? 'friends.online' : 'friends.offline')}
                </span>
              </PlayerIdentity>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SearchResults({
  search,
  additions,
  titleId,
}: {
  search: ReturnType<typeof useUserSearch>;
  additions: ReturnType<typeof useAddFriend>;
  titleId: string;
}) {
  const { t } = useTranslation();
  const friendIds = useFriendsStore((state) => state.friends);
  const listLoaded = useFriendsStore((state) => state.loaded);
  // The friends store is current after an add or a remove; a result's own flag is as old
  // as the search that returned it.
  const isFriend = (result: UserSearchResult) =>
    listLoaded ? friendIds.some((f) => f.user_id === result.user_id) : result.is_friend;
  const settled = search.status === 'READY' && search.searched === search.term;

  return (
    <section aria-labelledby={titleId} aria-busy={search.status === 'SEARCHING'}>
      <h3 id={titleId} className="sr-only">
        {t('friends.search.resultsTitle')}
      </h3>
      <p role="status" className="sr-only">
        {settled && t('friends.search.resultCount', { count: search.results.length })}
      </p>
      {(search.status === 'SEARCHING' || (search.status !== 'ERROR' && !settled)) && (
        <Loading label={t('friends.search.searching')} />
      )}
      {search.status === 'ERROR' && (
        <State
          icon="disconnected"
          title={t('friends.search.errorTitle')}
          body={t('friends.search.errorBody')}
          action={{ label: t('common.retry'), icon: 'history', onClick: search.retry }}
          alert
        />
      )}
      {settled && search.results.length === 0 && (
        <State
          icon="search"
          title={t('friends.search.emptyTitle')}
          body={t('friends.search.emptyBody', { term: search.term })}
        />
      )}
      {settled && search.results.length > 0 && (
        <ul className={styles.list}>
          {search.results.map((result) => {
            const friend = isFriend(result);
            const adding = additions.adding.has(result.user_id);
            const failure = additions.failed.get(result.user_id);
            return (
              <li key={result.user_id} className={styles.row}>
                <PlayerIdentity player={result}>
                  {friend && (
                    <span className={styles.badgeFriend}>
                      <Icon name="check" />
                      {t('friends.search.alreadyFriend')}
                    </span>
                  )}
                </PlayerIdentity>
                {!friend && (
                  <Button
                    icon="userAdd"
                    sizeClassName={styles.addButton}
                    onClick={() => !adding && void additions.add(result.user_id)}
                    aria-disabled={adding || undefined}
                    aria-busy={adding || undefined}
                    aria-label={t('friends.search.addLabel', { username: result.username })}
                    className={styles.addPlacement}
                  >
                    {t(adding ? 'friends.search.adding' : 'friends.search.add')}
                  </Button>
                )}
                {failure && (
                  <p role="alert" className={styles.rowError}>
                    {t(
                      failure === 'NOT_FOUND'
                        ? 'friends.search.addNotFound'
                        : 'friends.search.addFailed',
                    )}
                  </p>
                )}
              </li>
            );
          })}
          {search.hasMore && (
            <li className="flex">
              <button
                type="button"
                onClick={search.loadMore}
                aria-busy={search.loadingMore || undefined}
                className={styles.showMore}
              >
                {t(search.loadingMore ? 'friends.search.loadingMore' : 'friends.search.more')}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** Avatar and name, which open the player's profile, with a line of status under the name. */
function PlayerIdentity({
  player,
  children,
}: {
  player: Pick<Friend, 'user_id' | 'username' | 'avatar_url'>;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => openProfileModal(player.user_id)}
      aria-haspopup="dialog"
      aria-label={t('lobby.players.openProfile', { username: player.username })}
      className={styles.profileButton}
    >
      <span className={styles.avatar}>
        <AvatarImage
          src={player.avatar_url}
          className={styles.avatarImage}
          placeholderClassName={styles.avatarPlaceholder}
        />
      </span>
      <span className={styles.identity}>
        <span className={styles.name}>{player.username}</span>
        {children}
      </span>
    </button>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className={styles.state}>
      <LoadingDots size="sm" label={label} />
    </div>
  );
}

function State({
  icon,
  title,
  body,
  action,
  alert = false,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; icon: IconName; onClick: () => void };
  alert?: boolean;
}) {
  return (
    <div role={alert ? 'alert' : undefined} className={styles.state}>
      <Icon name={icon} className={styles.stateIcon} />
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{body}</p>
      {action && (
        <button type="button" onClick={action.onClick} className={styles.stateAction}>
          <Icon name={action.icon} />
          {action.label}
        </button>
      )}
    </div>
  );
}
