/**
 * Friends and blocking REST bindings — Bruno `rest-api/05 - Friends/` and `06 - Blocking/`.
 *
 * Friendship needs a request and its acceptance; the server owns every relationship state
 * and decides each action again when it is sent.
 */

import { apiRequest } from '@shared/api';
import type {
  BlockResponse,
  Friend,
  FriendListQuery,
  FriendListResponse,
  FriendRequest,
  FriendRequestListResponse,
  PublicProfile,
  SendFriendRequestBody,
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

export const removeFriend = (userId: number): Promise<void> =>
  apiRequest(`/friends/${userId}`, { method: 'DELETE' });

export const sendFriendRequest = (body: SendFriendRequestBody): Promise<FriendRequest> =>
  apiRequest('/friends/requests', { method: 'POST', body });

export const listFriendRequests = (): Promise<FriendRequestListResponse> =>
  apiRequest('/friends/requests');

/** The recipient accepts; the answer is the new friend. */
export const acceptFriendRequest = (requestId: number): Promise<Friend> =>
  apiRequest(`/friends/requests/${requestId}/accept`, { method: 'POST' });

export const declineFriendRequest = (requestId: number): Promise<void> =>
  apiRequest(`/friends/requests/${requestId}/decline`, { method: 'POST' });

/** The sender withdraws their own request before it is answered. */
export const cancelFriendRequest = (requestId: number): Promise<void> =>
  apiRequest(`/friends/requests/${requestId}`, { method: 'DELETE' });

export const blockUser = (userId: number): Promise<BlockResponse> =>
  apiRequest(`/users/${userId}/block`, { method: 'PUT' });

export const unblockUser = (userId: number): Promise<void> =>
  apiRequest(`/users/${userId}/block`, { method: 'DELETE' });

/** The signed-in user's relationship to `userId`, as the public profile reports it. */
export const getRelationship = async (
  userId: number,
): Promise<Pick<PublicProfile, 'relationship' | 'friend_request_id'>> => {
  const profile = await apiRequest<PublicProfile>(`/users/${userId}`);
  return { relationship: profile.relationship, friend_request_id: profile.friend_request_id };
};

/** Username substring search for friend discovery: one page, `q` trimmed to 1..20 characters. */
export const searchUsers = (
  query: UserSearchQuery,
  signal?: AbortSignal,
): Promise<UserSearchResponse> =>
  apiRequest('/users/search', { query, ...(signal ? { signal } : {}) });
