/**
 * Whether the signed-in user and `userId` are friends, with Add Friend and Remove Friend.
 *
 * The answer comes from `GET /api/friends`, read fresh when the hook mounts rather than
 * trusted from an earlier screen, and again after a reconnect. Until that read lands the
 * status is `LOADING`, so a profile never shows a friendship from a stale list. Add and
 * Remove update the shared friends store from the server's answer, so every list that
 * reads it agrees at once. Friendship is immediate and mutual: there is no pending state.
 *
 * `ALREADY_FRIENDS` and `NOT_FRIENDS` mean the list was out of date, not that the action
 * failed, so they settle the friendship the way the server reports it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@shared/api';
import { useOnReconnect } from '@shared/hooks';

import { addFriend, listAllFriends, removeFriend } from '../api';
import { useFriendsStore } from '../store/friendsStore';

export type FriendshipStatus = 'LOADING' | 'READY' | 'ERROR';
export type FriendshipChange = 'ADDING' | 'REMOVING';

export function useFriendship(userId: number) {
  const isFriend = useFriendsStore((state) => state.friends.some((f) => f.user_id === userId));
  const [status, setStatus] = useState<FriendshipStatus>('LOADING');
  const [change, setChange] = useState<FriendshipChange | null>(null);
  const [failed, setFailed] = useState<FriendshipChange | null>(null);
  const mounted = useRef(true);
  // Guards a second press that lands before the first one's state has rendered.
  const busy = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setStatus('LOADING');
    try {
      const { friends, friendCount } = await listAllFriends();
      if (!mounted.current) return;
      useFriendsStore.getState().setFriends(friends, friendCount);
      setStatus('READY');
    } catch {
      if (mounted.current && !quiet) setStatus('ERROR');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  useOnReconnect(() => void load(true));

  const add = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChange('ADDING');
    setFailed(null);
    try {
      const friend = await addFriend({ user_id: userId });
      useFriendsStore.getState().addFriend(friend);
    } catch (cause) {
      if ((cause as ApiError).code === 'ALREADY_FRIENDS') await load(true);
      else if (mounted.current) setFailed('ADDING');
    } finally {
      busy.current = false;
      if (mounted.current) setChange(null);
    }
  }, [load, userId]);

  const remove = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChange('REMOVING');
    setFailed(null);
    try {
      await removeFriend(userId);
      useFriendsStore.getState().removeFriend(userId);
    } catch (cause) {
      if ((cause as ApiError).code === 'NOT_FRIENDS')
        useFriendsStore.getState().removeFriend(userId);
      else if (mounted.current) setFailed('REMOVING');
    } finally {
      busy.current = false;
      if (mounted.current) setChange(null);
    }
  }, [userId]);

  return {
    status,
    /** Meaningful only once `status` is `READY`. */
    isFriend,
    /** The change in flight, if any; a second one is ignored until it settles. */
    change,
    /** The change that last failed for a reason other than a stale list. */
    failed,
    add,
    remove,
    retry: useCallback(() => void load(), [load]),
  };
}
