/**
 * Chat store: the channels, conversations and panel state of Chat v2.
 *
 * It mirrors what Channel Service reported — channels from `GET /api/v2/channels` and the
 * access events, messages from history and `chat.message.created` — plus two things that
 * exist only in this tab: messages still waiting for their ack, and the unread counts.
 * The contract has no read state, so unread counts are this tab's own tally of messages
 * that arrived while their conversation was not in view; they are never sent anywhere.
 *
 * It is separate from the room and game stores: a chat message never touches board, turn
 * or membership state. Nothing is persisted.
 */

import { create } from 'zustand';

import type {
  ChannelAccess,
  ChannelAccessReason,
  ChannelLastMessage,
  ChannelPeer,
  ChannelType,
  ChatMessage,
} from '@shared/types';

import { compareMessages, mergeMessages } from '../model/messages';

export interface ChatChannel {
  channel_id: number;
  type: ChannelType;
  peer: ChannelPeer | null;
  /** `room_code` is unknown until the channel list reports it. */
  room: { room_id: number; room_code: string | null } | null;
  last_message: ChannelLastMessage | null;
  access: ChannelAccess;
  /** Why access last changed, when an event said so. */
  reason: ChannelAccessReason | null;
}

export type HistoryStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export interface ChannelHistory {
  /** Oldest first. */
  messages: ChatMessage[];
  /** `before` for the next older page; `null` once the oldest retained message is loaded. */
  cursor: string | null;
  status: HistoryStatus;
  loadingOlder: boolean;
  olderFailed: boolean;
}

/**
 * Why a message is not sent. `OFFLINE`, `TIMEOUT`, `UNAVAILABLE` and `READ_ONLY` (refused
 * while the user's match runs) may be retried with the same `request_id`; `REVOKED` and
 * `INVALID` are final answers from the server.
 */
export type SendFailure =
  'OFFLINE' | 'TIMEOUT' | 'UNAVAILABLE' | 'READ_ONLY' | 'REVOKED' | 'INVALID';

/** A message this tab sent that has no ack yet. */
export interface PendingMessage {
  request_id: string;
  channel_id: number;
  text: string;
  created_at: string;
  status: 'SENDING' | 'FAILED';
  failure: SendFailure | null;
  /**
   * The persisted message's id once its `chat.message.created` arrived before the ack, so
   * the conversation shows it once.
   */
  settled_message_id: string | null;
}

export type ChatView = { kind: 'LIST' } | { kind: 'CHANNEL'; channelId: number };

export type ChatTab = 'ROOM' | 'FRIENDS';

export type ListStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

interface ChatState {
  /** The user this state belongs to; another sign-in starts from empty. */
  ownerId: number | null;
  /** The gateway sent `chat.ready` on the open socket; sending is possible. */
  ready: boolean;
  channels: Record<number, ChatChannel>;
  channelsStatus: ListStatus;
  histories: Record<number, ChannelHistory>;
  pending: Record<string, PendingMessage>;
  unread: Record<number, number>;

  isOpen: boolean;
  view: ChatView;
  tab: ChatTab | null;
  /** A friend whose direct channel is being resolved. */
  openingPeerId: number | null;
  openFailedPeerId: number | null;

  resetFor: (ownerId: number) => void;
  /** Forget everything, on log out. */
  clear: () => void;
  setReady: (ready: boolean) => void;
  setChannelsStatus: (status: ListStatus) => void;
  /** Replace the accessible channels with a fresh list; anything missing lost access. */
  replaceChannels: (channels: ChatChannel[]) => void;
  upsertChannel: (channel: ChatChannel) => void;
  setAccess: (channelId: number, access: ChannelAccess, reason: ChannelAccessReason | null) => void;
  /** Show a user's new username and avatar on their direct channels. */
  updatePeer: (userId: number, username: string, avatarUrl: string) => void;

  setHistory: (channelId: number, patch: Partial<ChannelHistory>) => void;
  addMessages: (channelId: number, messages: ChatMessage[]) => void;
  prependOlder: (channelId: number, messages: ChatMessage[], cursor: string | null) => void;
  dropHistory: (channelId: number) => void;

  addPending: (message: PendingMessage) => void;
  updatePending: (requestId: string, patch: Partial<PendingMessage>) => void;
  removePending: (requestId: string) => void;

  bumpUnread: (channelId: number, by?: number) => void;
  clearUnread: (channelId: number) => void;

  open: (view?: ChatView) => void;
  close: () => void;
  setView: (view: ChatView) => void;
  setTab: (tab: ChatTab) => void;
  setOpening: (peerId: number | null, failed?: boolean) => void;
}

const emptyHistory: ChannelHistory = {
  messages: [],
  cursor: null,
  status: 'IDLE',
  loadingOlder: false,
  olderFailed: false,
};

const initial = {
  ownerId: null,
  ready: false,
  channels: {},
  channelsStatus: 'IDLE' as ListStatus,
  histories: {},
  pending: {},
  unread: {},
  isOpen: false,
  view: { kind: 'LIST' } as ChatView,
  tab: null,
  openingPeerId: null,
  openFailedPeerId: null,
};

/** The newer of two previews, so a stale list never hides a message already seen live. */
function newerLast(
  a: ChannelLastMessage | null,
  b: ChannelLastMessage | null,
): ChannelLastMessage | null {
  if (!a) return b;
  if (!b) return a;
  const order = compareMessages({ ...a, channel_id: 0 }, { ...b, channel_id: 0 });
  return order >= 0 ? a : b;
}

const omit = <T>(record: Record<number, T>, key: number): Record<number, T> => {
  const next = { ...record };
  delete next[key];
  return next;
};

export const useChatStore = create<ChatState>((set) => ({
  ...initial,

  resetFor: (ownerId) =>
    set((state) => (state.ownerId === ownerId ? state : { ...initial, ownerId })),
  clear: () => set(initial),

  setReady: (ready) => set({ ready }),
  setChannelsStatus: (channelsStatus) => set({ channelsStatus }),

  replaceChannels: (list) =>
    set((state) => {
      const channels: Record<number, ChatChannel> = {};
      for (const channel of list) {
        const known = state.channels[channel.channel_id];
        channels[channel.channel_id] = {
          ...channel,
          room:
            channel.room && known?.room && !channel.room.room_code
              ? { ...channel.room, room_code: known.room.room_code }
              : channel.room,
          last_message: newerLast(channel.last_message, known?.last_message ?? null),
        };
      }
      // A channel the server no longer lists is one this user cannot use now. Its history
      // is no longer readable, so it is forgotten rather than kept on screen.
      let { histories, unread } = state;
      for (const known of Object.values(state.channels)) {
        if (channels[known.channel_id]) continue;
        channels[known.channel_id] = { ...known, access: 'INACTIVE' };
        histories = omit(histories, known.channel_id);
        unread = omit(unread, known.channel_id);
      }
      return { channels, histories, unread, channelsStatus: 'READY' };
    }),

  upsertChannel: (channel) =>
    set((state) => {
      const known = state.channels[channel.channel_id];
      return {
        channels: {
          ...state.channels,
          [channel.channel_id]: {
            ...channel,
            peer: channel.peer ?? known?.peer ?? null,
            room: channel.room
              ? {
                  ...channel.room,
                  room_code: channel.room.room_code ?? known?.room?.room_code ?? null,
                }
              : (known?.room ?? null),
            last_message: newerLast(channel.last_message, known?.last_message ?? null),
          },
        },
      };
    }),

  updatePeer: (userId, username, avatarUrl) =>
    set((state) => {
      const touched = Object.values(state.channels).filter((c) => c.peer?.user_id === userId);
      if (touched.length === 0) return state;
      const channels = { ...state.channels };
      for (const channel of touched) {
        channels[channel.channel_id] = {
          ...channel,
          peer: { ...channel.peer!, username, avatar_url: avatarUrl },
        };
      }
      return { channels };
    }),

  setAccess: (channelId, access, reason) =>
    set((state) => {
      const known = state.channels[channelId];
      if (!known) return state;
      const channels = { ...state.channels, [channelId]: { ...known, access, reason } };
      // A read-only channel stays on screen: its messages are still readable.
      if (access !== 'INACTIVE') return { channels };
      return {
        channels,
        histories: omit(state.histories, channelId),
        unread: omit(state.unread, channelId),
      };
    }),

  setHistory: (channelId, patch) =>
    set((state) => ({
      histories: {
        ...state.histories,
        [channelId]: { ...(state.histories[channelId] ?? emptyHistory), ...patch },
      },
    })),

  addMessages: (channelId, messages) =>
    set((state) => {
      if (messages.length === 0) return state;
      const history = state.histories[channelId];
      const newest = [...messages].sort(compareMessages).at(-1);
      const channel = state.channels[channelId];
      return {
        histories:
          history && history.status === 'READY'
            ? {
                ...state.histories,
                [channelId]: { ...history, messages: mergeMessages(history.messages, messages) },
              }
            : state.histories,
        channels:
          channel && newest
            ? {
                ...state.channels,
                [channelId]: {
                  ...channel,
                  last_message: newerLast(channel.last_message, {
                    message_id: newest.message_id,
                    sender_user_id: newest.sender_user_id,
                    text: newest.text,
                    sent_at: newest.sent_at,
                    expires_at: newest.expires_at,
                  }),
                },
              }
            : state.channels,
      };
    }),

  prependOlder: (channelId, messages, cursor) =>
    set((state) => {
      const history = state.histories[channelId];
      if (!history) return state;
      return {
        histories: {
          ...state.histories,
          [channelId]: {
            ...history,
            messages: mergeMessages(history.messages, messages),
            cursor,
            loadingOlder: false,
            olderFailed: false,
          },
        },
      };
    }),

  dropHistory: (channelId) => set((state) => ({ histories: omit(state.histories, channelId) })),

  addPending: (message) =>
    set((state) => ({ pending: { ...state.pending, [message.request_id]: message } })),
  updatePending: (requestId, patch) =>
    set((state) => {
      const known = state.pending[requestId];
      if (!known) return state;
      return { pending: { ...state.pending, [requestId]: { ...known, ...patch } } };
    }),
  removePending: (requestId) =>
    set((state) => {
      if (!state.pending[requestId]) return state;
      const pending = { ...state.pending };
      delete pending[requestId];
      return { pending };
    }),

  bumpUnread: (channelId, by = 1) =>
    set((state) => ({
      unread: { ...state.unread, [channelId]: (state.unread[channelId] ?? 0) + by },
    })),
  clearUnread: (channelId) =>
    set((state) => (state.unread[channelId] ? { unread: omit(state.unread, channelId) } : state)),

  open: (view) => set((state) => ({ isOpen: true, view: view ?? state.view })),
  close: () => set({ isOpen: false }),
  setView: (view) => set({ view }),
  setTab: (tab) => set({ tab }),
  setOpening: (openingPeerId, failed = false) =>
    set((state) => ({
      openingPeerId,
      openFailedPeerId: failed ? state.openingPeerId : null,
    })),
}));

/** Unread messages across every channel the user can still read. */
export const selectTotalUnread = (state: ChatState): number =>
  Object.entries(state.unread).reduce((sum, [id, count]) => {
    const access = state.channels[Number(id)]?.access;
    return access === 'ACTIVE' || access === 'READ_ONLY' ? sum + count : sum;
  }, 0);
