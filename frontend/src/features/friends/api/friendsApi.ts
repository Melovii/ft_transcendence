/**
 * Friends REST bindings — Bruno `rest-api/05 - Friends/`.
 *
 * Friendship is immediate and mutual; there is no request/accept workflow.
 */

import { apiRequest } from '@shared/api';
import type {
  AddFriendRequest,
  Friend,
  FriendListQuery,
  FriendListResponse,
  UserSearchQuery,
  UserSearchResponse,
} from '@shared/types';

/** The contract's largest page. */
const FRIEND_PAGE_LIMIT = 100;

export const listFriends = (query: FriendListQuery = {}): Promise<FriendListResponse> =>
  apiRequest('/friends', { query });

/**
 * The whole friend list, read page by page until `has_more` is false. Friendship is
 * decided from this list, so a friend past the first page must not read as a stranger.
 */
export async function listAllFriends(): Promise<{ friends: Friend[]; friendCount: number }> {
  const friends: Friend[] = [];
  let page: FriendListResponse;
  do {
    page = await listFriends({ limit: FRIEND_PAGE_LIMIT, offset: friends.length });
    friends.push(...page.friends);
  } while (page.has_more && page.friends.length > 0);
  return { friends, friendCount: page.friend_count };
}

export const addFriend = (body: AddFriendRequest): Promise<Friend> =>
  apiRequest('/friends', { method: 'POST', body });

export const removeFriend = (userId: number): Promise<void> =>
  apiRequest(`/friends/${userId}`, { method: 'DELETE' });

/** Username substring search for friend discovery: one page, `q` trimmed to 1..20 characters. */
export const searchUsers = (
  query: UserSearchQuery,
  signal?: AbortSignal,
): Promise<UserSearchResponse> =>
  apiRequest('/users/search', { query, ...(signal ? { signal } : {}) });
