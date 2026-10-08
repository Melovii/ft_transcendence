/**
 * Add Friend from a list of players, such as search results.
 *
 * Friendship is immediate and mutual: the server's answer is the new friend, recorded in
 * the shared friends store, so every list that reads it agrees at once and `friend_count`
 * moves with it. `ALREADY_FRIENDS` means the list was out of date rather than that the add
 * failed, so the list is read fresh instead of reporting an error. Each player has at most
 * one add in flight; a second press is ignored until it settles.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@shared/api';

import { addFriend, listAllFriends } from '../api';
import { useFriendsStore } from '../store/friendsStore';

export type AddFriendFailure = 'NOT_FOUND' | 'FAILED';

export function useAddFriend() {
  const [adding, setAdding] = useState<ReadonlySet<number>>(new Set());
  const [failed, setFailed] = useState<ReadonlyMap<number, AddFriendFailure>>(new Map());
  const busy = useRef(new Set<number>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const add = useCallback(async (userId: number) => {
    if (busy.current.has(userId)) return;
    busy.current.add(userId);
    setAdding(new Set(busy.current));
    setFailed((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
    try {
      const friend = await addFriend({ user_id: userId });
      useFriendsStore.getState().addFriend(friend);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : null;
      if (code === 'ALREADY_FRIENDS') {
        try {
          const { friends, friendCount } = await listAllFriends();
          useFriendsStore.getState().setFriends(friends, friendCount);
        } catch {
          // The list stays as it was; the friendship shows on its next read.
        }
      } else if (mounted.current) {
        const failure: AddFriendFailure = code === 'USER_NOT_FOUND' ? 'NOT_FOUND' : 'FAILED';
        setFailed((current) => new Map(current).set(userId, failure));
      }
    } finally {
      busy.current.delete(userId);
      if (mounted.current) setAdding(new Set(busy.current));
    }
  }, []);

  return { add, adding, failed };
}
