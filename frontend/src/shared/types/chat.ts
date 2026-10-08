/**
 * Chat v2 types, from Bruno `v2/chat-rest-api` and `v2/chat-websocket`.
 *
 * Chat is organized in channels owned by Channel Service. A `DIRECT` channel is a
 * private conversation between exactly two friends; a `ROOM` channel is the one common
 * conversation of a room, created with the room and open to its currently eligible
 * members. The server decides access on every list, history read and send; nothing here
 * is a permission the client may assume.
 */

export type ChannelType = 'DIRECT' | 'ROOM';

/** Whether the signed-in user can use a channel right now. */
export type ChannelAccess = 'ACTIVE' | 'INACTIVE';

/** Why a channel became available or changed access. */
export type ChannelAccessReason =
  | 'ROOM_CREATED'
  | 'ROOM_JOINED'
  | 'BACK_TO_LOBBY'
  | 'GAME_FINISHED'
  | 'ROOM_LEFT'
  | 'KICKED_BY_HOST'
  | 'POST_GAME_TIMEOUT'
  | 'ROOM_CLOSED'
  | 'DIRECT_CREATED'
  | 'FRIENDSHIP_ADDED'
  | 'FRIENDSHIP_REMOVED';

/** The other participant of a `DIRECT` channel. */
export interface ChannelPeer {
  user_id: number;
  username: string;
  avatar_url: string;
  is_online: boolean;
}

/** The room of a `ROOM` channel. */
export interface ChannelRoom {
  room_id: number;
  room_code: string;
}

/**
 * One retained message. `sent_at` and `expires_at` are assigned by Channel Service;
 * `message_id` is its stable identity.
 */
export interface ChatMessage {
  message_id: string;
  channel_id: number;
  sender_user_id: number;
  text: string;
  sent_at: string;
  expires_at: string;
}

/** A channel's newest visible message, as the channel list previews it. */
export type ChannelLastMessage = Omit<ChatMessage, 'channel_id'>;

/** One entry of `GET /api/v2/channels`. */
export interface ChannelSummary {
  channel_id: number;
  type: ChannelType;
  /** `DIRECT` only. */
  peer: ChannelPeer | null;
  /** `ROOM` only. */
  room: ChannelRoom | null;
  last_message: ChannelLastMessage | null;
}

/** `GET /api/v2/channels` query. `after` is the opaque `next_cursor` of the previous page. */
export interface ChannelListQuery {
  limit?: number | undefined;
  after?: string | undefined;
}

export interface ChannelListResponse {
  channels: ChannelSummary[];
  next_cursor: string | null;
}

/** `GET /api/v2/channels/{channel_id}/messages` query, newest first. */
export interface MessageHistoryQuery {
  limit?: number | undefined;
  before?: string | undefined;
}

export interface MessageHistoryResponse {
  /** Newest first. */
  messages: ChatMessage[];
  next_cursor: string | null;
}

/** `POST /api/v2/channels/direct` body. */
export interface OpenDirectChannelRequest {
  peer_user_id: number;
}

/** `POST /api/v2/channels/direct` response: `201` when created, `200` when it existed. */
export interface OpenDirectChannelResponse {
  channel_id: number;
  type: 'DIRECT';
  peer: ChannelPeer;
  created_at: string;
}

/** Trimmed message text length the contract accepts. */
export const CHAT_MESSAGE_MAX_LENGTH = 500;

/* ------------------------------ socket payloads ------------------------------ */

/** `chat.message.send` payload. The sender is the authenticated session, never a field. */
export interface ChatSendPayload {
  channel_id: number;
  /** Trimmed, 1..500 characters. */
  text: string;
}

/** `ack` payload for `chat.message.send`, sent after the message is persisted. */
export interface ChatSendAck {
  message_id: string;
  channel_id: number;
  stored: boolean;
  sent_at: string;
  expires_at: string;
}

/** `chat.ready` payload, emitted once per connection after the handshake. */
export interface ChatReadyPayload {
  user_id: number;
  connected_at: string;
}

/**
 * `chat.message.created` payload. It carries no `sent_at` of its own; the envelope's
 * `sent_at` is the persisted message's time.
 */
export type ChatMessageCreatedPayload = Omit<ChatMessage, 'sent_at'>;

/** `chat.channel.available` payload. */
export interface ChannelAvailablePayload {
  channel_id: number;
  channel_type: ChannelType;
  /** `null` for `DIRECT`. */
  room_id: number | null;
  access: ChannelAccess;
  reason: ChannelAccessReason;
  /** `DIRECT` only. */
  peer?: ChannelPeer | null;
}

/** `chat.channel.access_changed` payload. */
export interface ChannelAccessChangedPayload {
  channel_id: number;
  channel_type: ChannelType;
  /** `null` for `DIRECT`. */
  room_id: number | null;
  access: ChannelAccess;
  reason: ChannelAccessReason;
}

/** `room.invite.received` payload: a transient notification, never a chat message. */
export interface RoomInvitePayload {
  invite_id: string;
  /** Delivery deadline; an expired invitation is not shown. */
  expires_at: string;
  room_id: number;
  room_code: string;
  from_user: { user_id: number; username: string };
}
