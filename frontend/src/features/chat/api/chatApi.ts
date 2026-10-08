/**
 * Chat REST v2 bindings — Bruno `v2/chat-rest-api/00 - Channels/`.
 *
 * Every call re-evaluates access on the server: a channel the user lost access to is left
 * out of the list and refuses its history, whatever the client last knew about it.
 */

import { apiRequest } from '@shared/api';
import { CHAT_API_PATH } from '@shared/constants';
import type {
  ChannelListQuery,
  ChannelListResponse,
  MessageHistoryQuery,
  MessageHistoryResponse,
  OpenDirectChannelResponse,
} from '@shared/types';

/** Accessible channels, newest caller-visible activity first. */
export const listChannels = (query: ChannelListQuery = {}): Promise<ChannelListResponse> =>
  apiRequest(CHAT_API_PATH, { query: { limit: query.limit, after: query.after } });

/** Retained messages, newest first; `before` is the previous page's `next_cursor`. */
export const getMessageHistory = (
  channelId: number,
  query: MessageHistoryQuery = {},
): Promise<MessageHistoryResponse> =>
  apiRequest(`${CHAT_API_PATH}/${channelId}/messages`, {
    query: { limit: query.limit, before: query.before },
  });

/** Resolve (or create) the friend-only direct channel with `peerUserId`. */
export const openDirectChannel = (peerUserId: number): Promise<OpenDirectChannelResponse> =>
  apiRequest(`${CHAT_API_PATH}/direct`, { method: 'POST', body: { peer_user_id: peerUserId } });
