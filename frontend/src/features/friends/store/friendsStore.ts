/**
 * Friends store — persistent social state read over REST.
 *
 * `is_online` is live presence maintained by the backend; the frontend displays it and
 * never infers it from its own socket state.
 */

import { create } from 'zustand';

import type { Friend } from '@shared/types';

interface FriendsState {
  friends: Friend[];
  friendCount: number;
  /** The list has been read from the server at least once this session. */
  loaded: boolean;

  setFriends: (friends: Friend[], friendCount: number) => void;
  /** Record a friendship the server just confirmed. */
  addFriend: (friend: Friend) => void;
  /** Drop a friendship the server just ended, or reported as absent. */
  removeFriend: (userId: number) => void;
  clear: () => void;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  friends: [],
  friendCount: 0,
  loaded: false,

  setFriends: (friends, friendCount) => set({ friends, friendCount, loaded: true }),
  addFriend: (friend) =>
    set((state) => {
      if (state.friends.some((f) => f.user_id === friend.user_id)) return state;
      return { friends: [...state.friends, friend], friendCount: state.friendCount + 1 };
    }),
  removeFriend: (userId) =>
    set((state) => {
      if (!state.friends.some((f) => f.user_id === userId)) return state;
      return {
        friends: state.friends.filter((f) => f.user_id !== userId),
        friendCount: Math.max(0, state.friendCount - 1),
      };
    }),
  clear: () => set({ friends: [], friendCount: 0, loaded: false }),
}));
