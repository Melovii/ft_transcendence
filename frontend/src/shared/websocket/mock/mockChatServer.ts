/**
 * In-memory Chat Gateway and Channel Service speaking the Bruno Chat v2 contract.
 *
 * One instance (`mockChat`) serves both the mock chat socket (`/ws/v2/channels`) and the
 * mock Chat REST v2 routes in `shared/api/mock`, so a message sent over the socket is the
 * message history returns, as in production.
 *
 * It applies the contract's rules from the signed-in user's side: DIRECT channels are
 * limited to active friends; the ROOM channel of a room is open to its member while the
 * room is `WAITING`, `COUNTDOWN` or `IN_GAME`, and each stretch of access is a visibility
 * window, so history never shows what was said before the user joined or while they were
 * away. While the user plays a running match every channel is read only, and it opens
 * again when the match pauses for players or ends.
 * Sends are validated, persisted, acked and fanned out; a `request_id` reused with the
 * same content returns the original result, with different content `INVALID_EVENT`.
 *
 * Other users act from the console:
 *
 *   mockSockets.chat.directMessage(43, 'hi!')         // a friend writes
 *   mockSockets.chat.roomMessage(48, 'ready?')         // a room player writes
 *   mockSockets.chat.failNext('SERVICE_UNAVAILABLE')   // the next send fails, retryable
 *   mockSockets.chat.dropNextAck()                     // stored, but the ack is lost
 *   mockSockets.chat.loseNextSend()                    // stored, then ack and event are lost
 *   mockSockets.chat.duplicateNext()                   // the next event arrives twice
 *   mockSockets.chat.dropConnection(3000)              // RECONNECTING, then chat.ready
 */

import { CHAT_MESSAGE_MAX_LENGTH } from '@shared/types';
import type {
  AckMessage,
  ChannelAccess,
  ChannelAccessReason,
  ChannelListResponse,
  ChannelPeer,
  ChannelSummary,
  ChatCommand,
  ChatMessage,
  ChatSendAck,
  ChatServerEvent,
  MessageHistoryResponse,
  OpenDirectChannelResponse,
  RoomInviteReceivedEvent,
  SocialEvent,
  WsErrorCode,
  WsErrorMessage,
} from '@shared/types';

import type { MockEndpoint, MockServerBinding } from './mockTransport';
import type { MockPlayer } from './mockRoomServer';
import { mockDirectory, mockRoomLifecycle, mockRooms } from './registry';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** `player_one`, the account the seeded conversations belong to. */
const SEED_SELF_ID = 42;
const INVITE_TTL_MS = 30_000;
const REQUEST_ID_PATTERN = /^[\x21-\x7e]{1,64}$/;

/** A Chat REST v2 error, turned into the `{ error }` envelope by the mock REST server. */
export class MockChannelError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'MockChannelError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface StoredMessage extends ChatMessage {
  /** The channel's monotonic sequence: what visibility windows are measured in. */
  seq: number;
}

interface StoredChannel {
  channel_id: number;
  type: 'DIRECT' | 'ROOM';
  /** DIRECT: the other participant. */
  peerId: number | null;
  /** ROOM: the room. */
  roomId: number | null;
  created_at: string;
  messages: StoredMessage[];
}

/** The signed-in user's ROOM access: the current epoch's windows `[from, to)` in sequence. */
interface RoomAccess {
  active: boolean;
  windows: { from: number; to: number | null }[];
  /** Why access last changed; a result's closed window reopens on Back to Lobby. */
  lastReason?: ChannelAccessReason;
}

type LedgerEntry = { hash: string; reply: AckMessage<ChatSendAck> | WsErrorMessage };

const now = (): string => new Date().toISOString();

/** A match whose turns are being played, not paused for players and not over. */
const isRunning = (phase: string): boolean => phase === 'WAITING_FOR_CLUE' || phase === 'GUESSING';

const toMessage = (stored: StoredMessage): ChatMessage => ({
  message_id: stored.message_id,
  channel_id: stored.channel_id,
  sender_user_id: stored.sender_user_id,
  text: stored.text,
  sent_at: stored.sent_at,
  expires_at: stored.expires_at,
});
const expiry = (sentAt: string): string =>
  new Date(Date.parse(sentAt) + RETENTION_MS).toISOString();

const encodeCursor = (value: number): string => btoa(`c:${value}`);
function decodeCursor(cursor: string, field: string): number {
  try {
    const decoded = atob(cursor);
    const value = Number(decoded.slice(2));
    if (decoded.startsWith('c:') && Number.isInteger(value) && value >= 0) return value;
  } catch {
    // Falls through to the validation error.
  }
  throw new MockChannelError(422, 'VALIDATION_ERROR', `${field} is not a valid cursor.`, { field });
}

function parseLimit(raw: unknown): number {
  const limit = raw === undefined ? 50 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new MockChannelError(
      422,
      'VALIDATION_ERROR',
      'limit must be an integer from 1 through 100.',
      {
        field: 'limit',
      },
    );
  }
  return limit;
}

export class MockChatServer implements MockServerBinding {
  private readonly endpoints = new Set<MockEndpoint>();
  private channels = new Map<number, StoredChannel>();
  private roomAccess = new Map<number, RoomAccess>();
  private ledger = new Map<string, LedgerEntry>();
  private nextChannelId = 7001;
  private nextRoomChannelId = 8001;
  private messageSeq = 0;
  private eventSeq = 0;
  private injectedFailure: 'SERVICE_UNAVAILABLE' | null = null;
  private loseNextAck = false;
  private repeatNextEvent = false;
  private muteNextSend = false;
  /** Whether the user's channels were last announced as read only for a running match. */
  private readOnly = false;

  constructor() {
    this.seed();
  }

  /* ------------------------------ transport side ---------------------------- */

  onOpen(endpoint: MockEndpoint): void {
    this.endpoints.add(endpoint);
    this.syncRooms();
    endpoint.deliver(this.event('chat.ready', { user_id: this.selfId(), connected_at: now() }));
  }

  onClose(endpoint: MockEndpoint): void {
    this.endpoints.delete(endpoint);
  }

  onCommand(endpoint: MockEndpoint, raw: unknown): void {
    const reply = this.handleSend(raw as Partial<ChatCommand>);
    if (reply) endpoint.deliver(reply);
  }

  /** Take every chat socket down; they reconnect after `reconnectAfterMs`. */
  dropConnection(reconnectAfterMs?: number): void {
    [...this.endpoints].forEach((endpoint) => endpoint.simulateDrop(reconnectAfterMs));
  }

  /* ------------------------------- test controls ---------------------------- */

  /** The next send fails before a terminal result, so retrying it is safe. */
  failNext(code: 'SERVICE_UNAVAILABLE' = 'SERVICE_UNAVAILABLE'): void {
    this.injectedFailure = code;
  }

  /** The next send is stored and broadcast, but its ack never arrives. */
  dropNextAck(): void {
    this.loseNextAck = true;
  }

  /**
   * The next send is stored, but neither its ack nor its event reaches any socket, as when
   * the connection dies right after the server accepted it. The client cannot know the
   * outcome until it asks again with the same `request_id`.
   */
  loseNextSend(): void {
    this.muteNextSend = true;
  }

  /** The next event is delivered twice, as a broker redelivery would. */
  duplicateNext(): void {
    this.repeatNextEvent = true;
  }

  /** A friend sends the signed-in user a direct message. */
  directMessage(fromUserId: number, text: string): ChatMessage | null {
    if (!mockDirectory.isFriend(fromUserId)) {
      console.warn(`[mock chat] ${fromUserId} is not a friend; Channel Service refuses the send.`);
      return null;
    }
    const channel = this.directChannel(fromUserId, true);
    return this.persist(channel, fromUserId, text);
  }

  /** A player in the signed-in user's room writes in the room chat. */
  roomMessage(fromUserId: number, text: string, roomId?: number): ChatMessage | null {
    this.syncRooms();
    const channel = [...this.channels.values()].find(
      (c) =>
        c.type === 'ROOM' &&
        (roomId === undefined ? this.roomAccess.get(c.roomId ?? -1)?.active : c.roomId === roomId),
    );
    const room = channel?.roomId ? mockRooms.get(channel.roomId) : undefined;
    if (!channel || !room?.hasMember(fromUserId)) {
      console.warn('[mock chat] no active room channel with that player in it.');
      return null;
    }
    const game = room.state().game;
    if (room.state().status === 'IN_GAME' && game && isRunning(game.current_turn.phase)) {
      console.warn('[mock chat] players cannot chat while their match is running.');
      return null;
    }
    return this.persist(channel, fromUserId, text);
  }

  /** A friend invites this user to a room. */
  inviteReceived(from: MockPlayer, roomId: number, roomCode: string): void {
    const sentAt = now();
    const event: RoomInviteReceivedEvent = {
      type: 'room.invite.received',
      event_id: this.nextEventId(),
      sent_at: sentAt,
      payload: {
        invite_id: `inv_${String(this.eventSeq).padStart(4, '0')}`,
        expires_at: new Date(Date.parse(sentAt) + INVITE_TTL_MS).toISOString(),
        room_id: roomId,
        room_code: roomCode,
        from_user: { user_id: from.user_id, username: from.username },
      },
    };
    this.broadcast(event);
  }

  /* ------------------------------- REST side -------------------------------- */

  /** `GET /api/v2/channels` */
  listChannels(query: { limit?: unknown; after?: unknown }): ChannelListResponse {
    this.syncRooms();
    const limit = parseLimit(query.limit);
    const offset = typeof query.after === 'string' ? decodeCursor(query.after, 'after') : 0;
    const visible = [...this.channels.values()]
      .filter((c) => this.canAccess(c))
      .map((c) => ({ channel: c, last: this.visibleMessages(c).at(-1) ?? null }))
      .sort((a, b) => {
        const at = a.last?.sent_at ?? a.channel.created_at;
        const bt = b.last?.sent_at ?? b.channel.created_at;
        return bt.localeCompare(at) || b.channel.channel_id - a.channel.channel_id;
      });
    const page = visible.slice(offset, offset + limit);
    return {
      channels: page.map(({ channel, last }) => this.summary(channel, last)),
      next_cursor: offset + limit < visible.length ? encodeCursor(offset + limit) : null,
    };
  }

  /** `GET /api/v2/channels/{channel_id}/messages` */
  history(channelId: number, query: { limit?: unknown; before?: unknown }): MessageHistoryResponse {
    this.syncRooms();
    const limit = parseLimit(query.limit);
    const channel = this.requireAccess(channelId);
    const before =
      typeof query.before === 'string' ? decodeCursor(query.before, 'before') : Infinity;
    const older = this.visibleMessages(channel).filter((m) => m.seq < before);
    const page = older.slice(-limit);
    const oldest = page[0];
    return {
      messages: page.reverse().map(toMessage),
      next_cursor: oldest && older.length > page.length ? encodeCursor(oldest.seq) : null,
    };
  }

  /** `POST /api/v2/channels/direct` */
  openDirect(peerUserId: unknown): { created: boolean; data: OpenDirectChannelResponse } {
    if (
      typeof peerUserId !== 'number' ||
      !Number.isInteger(peerUserId) ||
      peerUserId <= 0 ||
      peerUserId === this.selfId()
    ) {
      throw new MockChannelError(
        422,
        'VALIDATION_ERROR',
        'peer_user_id must be a positive integer other than your own.',
        { field: 'peer_user_id' },
      );
    }
    const peer = mockDirectory.user(peerUserId);
    if (!peer) {
      throw new MockChannelError(404, 'USER_NOT_FOUND', `User ${peerUserId} was not found.`, {
        user_id: peerUserId,
      });
    }
    if (!mockDirectory.isFriend(peerUserId)) {
      throw new MockChannelError(
        403,
        'NOT_PERMITTED',
        'Direct channels are available to friends only.',
        {
          peer_user_id: peerUserId,
        },
      );
    }
    const existing = this.directChannel(peerUserId, false);
    const channel = existing ?? this.directChannel(peerUserId, true);
    if (!channel) throw new Error('unreachable');
    return {
      created: !existing,
      data: {
        channel_id: channel.channel_id,
        type: 'DIRECT',
        peer,
        created_at: channel.created_at,
      },
    };
  }

  /**
   * A friendship became active or inactive over REST (accepted, removed, blocked,
   * restored): DIRECT access follows it.
   */
  friendshipChanged(
    peerUserId: number,
    friends: boolean,
    reason: ChannelAccessReason = friends ? 'FRIENDSHIP_ADDED' : 'FRIENDSHIP_REMOVED',
  ): void {
    const channel = this.directChannel(peerUserId, false);
    if (!channel) return;
    this.broadcast(
      this.event('chat.channel.access_changed', {
        channel_id: channel.channel_id,
        channel_type: 'DIRECT',
        room_id: null,
        access: friends ? this.liveAccess() : 'INACTIVE',
        reason,
      }),
    );
  }

  /** A social change from User/Auth, delivered to the user's chat sockets. */
  notify<T extends SocialEvent>(type: T['type'], payload: T['payload']): void {
    this.broadcast(this.event(type, payload));
  }

  /**
   * Bring ROOM channels in line with the rooms: provision a room's channel the first time
   * the user has access, and open or close a visibility window whenever access changes,
   * telling the user's sockets as Channel Service does.
   */
  syncRooms(): void {
    const self = this.selfId();
    for (const [roomId, server] of mockRooms) {
      const room = server.state();
      const me = room.players.find((p) => p.user_id === self);
      const member = me !== undefined;
      // ROOM access follows the member's own state: the lobby while the room waits or
      // counts down, the match while it runs; a result screen has none.
      const active =
        (me?.state === 'IN_LOBBY' && (room.status === 'WAITING' || room.status === 'COUNTDOWN')) ||
        (me?.state === 'IN_GAME' && room.status === 'IN_GAME');
      const access = this.roomAccess.get(roomId);
      if (!access) {
        if (!active) continue;
        const channel = this.roomChannel(roomId);
        this.roomAccess.set(roomId, { active: true, windows: [{ from: this.seqOf(), to: null }] });
        const created = room.players.length === 1 && room.host_user_id === self;
        this.accessEvent(
          'chat.channel.available',
          channel,
          true,
          created ? 'ROOM_CREATED' : 'ROOM_JOINED',
        );
        continue;
      }
      if (access.active === active) continue;
      const channel = this.roomChannel(roomId);
      if (active && access.lastReason === 'GAME_FINISHED') {
        // Back to Lobby opens a new visibility window in the same membership epoch.
        access.windows.push({ from: this.seqOf(), to: null });
        access.active = true;
        access.lastReason = 'BACK_TO_LOBBY';
        this.accessEvent('chat.channel.access_changed', channel, true, 'BACK_TO_LOBBY');
      } else if (active) {
        // A rejoin starts a new membership epoch: nothing from before is visible.
        this.roomAccess.set(roomId, { active: true, windows: [{ from: this.seqOf(), to: null }] });
        this.accessEvent('chat.channel.available', channel, true, 'ROOM_JOINED');
      } else {
        const open = access.windows.at(-1);
        if (open) open.to = this.seqOf();
        access.active = false;
        const reason: ChannelAccessReason =
          room.status === 'CLOSED' ? 'ROOM_CLOSED' : !member ? 'ROOM_LEFT' : 'GAME_FINISHED';
        access.lastReason = reason;
        this.accessEvent('chat.channel.access_changed', channel, false, reason);
      }
    }
    this.syncReadOnly();
  }

  /** Whether the user plays a match that is running now: nothing may be sent. */
  private inRunningMatch(): boolean {
    const self = this.selfId();
    for (const server of mockRooms.values()) {
      const room = server.state();
      const me = room.players.find((p) => p.user_id === self);
      if (me?.state === 'IN_GAME' && room.status === 'IN_GAME' && room.game) {
        if (isRunning(room.game.current_turn.phase)) return true;
      }
    }
    return false;
  }

  /** `ACTIVE`, or `READ_ONLY` while the user's match runs. */
  private liveAccess(): ChannelAccess {
    return this.inRunningMatch() ? 'READ_ONLY' : 'ACTIVE';
  }

  /**
   * Tell the user's sockets when a match starts, pauses, resumes or ends: every channel they
   * can read turns read only, or back to usable.
   */
  private syncReadOnly(): void {
    const running = this.inRunningMatch();
    if (running === this.readOnly) return;
    this.readOnly = running;
    const self = this.selfId();
    const stillPlaying = [...mockRooms.values()].some((server) =>
      server.state().players.some((p) => p.user_id === self && p.state === 'IN_GAME'),
    );
    const reason: ChannelAccessReason = running
      ? 'GAME_RUNNING'
      : stillPlaying
        ? 'GAME_PAUSED'
        : 'GAME_FINISHED';
    for (const channel of this.channels.values()) {
      if (!this.canAccess(channel)) continue;
      this.broadcast(
        this.event('chat.channel.access_changed', {
          channel_id: channel.channel_id,
          channel_type: channel.type,
          room_id: channel.roomId,
          access: running ? 'READ_ONLY' : 'ACTIVE',
          reason,
        }),
      );
    }
  }

  /* -------------------------------- sending --------------------------------- */

  /** The reply to one send, or `null` when the ack is being dropped on purpose. */
  private handleSend(
    command: Partial<ChatCommand>,
  ): AckMessage<ChatSendAck> | WsErrorMessage | null {
    const requestId = typeof command.request_id === 'string' ? command.request_id : null;
    if (command.type !== 'chat.message.send' || !requestId || !REQUEST_ID_PATTERN.test(requestId)) {
      return this.error(requestId, 'INVALID_EVENT', 'The command envelope is invalid.');
    }
    const payload = command.payload;
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    const channelId = payload?.channel_id;
    const hash = JSON.stringify([channelId, payload?.text]);

    const key = `${this.selfId()}:${requestId}`;
    const recorded = this.ledger.get(key);
    if (recorded) {
      if (recorded.hash === hash) return structuredClone(recorded.reply);
      return this.error(
        requestId,
        'INVALID_EVENT',
        'request_id was already used with other content.',
      );
    }

    if (this.injectedFailure) {
      // Fails before a terminal result is recorded: the same request_id may be retried.
      this.injectedFailure = null;
      return this.error(requestId, 'SERVICE_UNAVAILABLE', 'Chat is temporarily unavailable.');
    }

    const remember = (reply: AckMessage<ChatSendAck> | WsErrorMessage) => {
      this.ledger.set(key, { hash, reply });
      return reply;
    };

    const length = Array.from(text).length;
    if (
      typeof channelId !== 'number' ||
      !Number.isInteger(channelId) ||
      channelId <= 0 ||
      length < 1 ||
      length > CHAT_MESSAGE_MAX_LENGTH
    ) {
      return remember(
        this.error(
          requestId,
          'INVALID_PAYLOAD',
          `text must be 1..${CHAT_MESSAGE_MAX_LENGTH} characters after trimming.`,
          {
            channel_id: channelId,
          },
        ),
      );
    }
    const channel = this.channels.get(channelId);
    if (!channel) {
      return remember(
        this.error(requestId, 'CHANNEL_NOT_FOUND', `Channel ${channelId} was not found.`, {
          channel_id: channelId,
        }),
      );
    }
    if (!this.canAccess(channel)) {
      const participant = channel.type === 'DIRECT' || this.roomAccess.has(channel.roomId ?? -1);
      return remember(
        participant
          ? this.error(
              requestId,
              'CHANNEL_ACCESS_REVOKED',
              `You can no longer send to channel ${channelId}.`,
              { channel_id: channelId },
            )
          : this.error(
              requestId,
              'NOT_CHANNEL_MEMBER',
              `User ${this.selfId()} is not a participant of channel ${channelId}.`,
              { channel_id: channelId },
            ),
      );
    }

    const muted = this.muteNextSend;
    this.muteNextSend = false;
    if (this.inRunningMatch()) {
      // Not memoized: the same message may be sent again once the match pauses.
      return this.error(
        requestId,
        'CHANNEL_READ_ONLY',
        'Chat is unavailable while the game is active.',
        {
          channel_id: channelId,
          reason: 'GAME_RUNNING',
        },
      );
    }
    const message = this.persist(channel, this.selfId(), text, muted);
    const ack: AckMessage<ChatSendAck> = {
      type: 'ack',
      request_id: requestId,
      ok: true,
      payload: {
        message_id: message.message_id,
        channel_id: message.channel_id,
        stored: true,
        sent_at: message.sent_at,
        expires_at: message.expires_at,
      },
    };
    remember(ack);
    if (muted) return null;
    if (this.loseNextAck) {
      this.loseNextAck = false;
      return null;
    }
    return ack;
  }

  /** Store a message and deliver it to the user's sockets. */
  private persist(
    channel: StoredChannel,
    senderId: number,
    text: string,
    silent = false,
  ): ChatMessage {
    const sentAt = now();
    this.messageSeq += 1;
    const stored: StoredMessage = {
      message_id: `msg_${String(this.messageSeq).padStart(6, '0')}`,
      channel_id: channel.channel_id,
      sender_user_id: senderId,
      text,
      sent_at: sentAt,
      expires_at: expiry(sentAt),
      seq: this.messageSeq,
    };
    channel.messages.push(stored);
    const message = toMessage(stored);
    if (!silent && this.canAccess(channel)) {
      const { message_id, channel_id, sender_user_id, expires_at } = message;
      this.broadcast({
        type: 'chat.message.created',
        event_id: this.nextEventId(),
        sent_at: sentAt,
        payload: { message_id, channel_id, sender_user_id, text, expires_at },
      });
    }
    return message;
  }

  /* -------------------------------- channels -------------------------------- */

  private selfId(): number {
    return mockDirectory.selfId();
  }

  private canAccess(channel: StoredChannel): boolean {
    if (channel.type === 'DIRECT')
      return channel.peerId !== null && mockDirectory.isFriend(channel.peerId);
    return this.roomAccess.get(channel.roomId ?? -1)?.active ?? false;
  }

  private requireAccess(channelId: number): StoredChannel {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new MockChannelError(404, 'CHANNEL_NOT_FOUND', `Channel ${channelId} was not found.`, {
        channel_id: channelId,
      });
    }
    if (!this.canAccess(channel)) {
      const participant = channel.type === 'DIRECT' || this.roomAccess.has(channel.roomId ?? -1);
      throw participant
        ? new MockChannelError(
            403,
            'CHANNEL_ACCESS_REVOKED',
            `Access to channel ${channelId} has ended.`,
            { channel_id: channelId },
          )
        : new MockChannelError(
            403,
            'NOT_CHANNEL_MEMBER',
            `Not a participant of channel ${channelId}.`,
            { channel_id: channelId },
          );
    }
    return channel;
  }

  /** Messages the user may see: all of a DIRECT channel, a ROOM's inside its windows. */
  private visibleMessages(channel: StoredChannel): StoredMessage[] {
    if (channel.type === 'DIRECT') return channel.messages;
    const windows = this.roomAccess.get(channel.roomId ?? -1)?.windows ?? [];
    return channel.messages.filter((m) =>
      windows.some((w) => m.seq > w.from && (w.to === null || m.seq <= w.to)),
    );
  }

  /** The high-water mark a window opens or closes at: every message so far. */
  private seqOf(): number {
    return this.messageSeq;
  }

  private summary(channel: StoredChannel, last: StoredMessage | null): ChannelSummary {
    const code = channel.roomId === null ? null : mockDirectory.roomCode(channel.roomId);
    return {
      channel_id: channel.channel_id,
      type: channel.type,
      peer: channel.type === 'DIRECT' ? this.peer(channel.peerId ?? 0) : null,
      room:
        channel.type === 'ROOM' ? { room_id: channel.roomId ?? 0, room_code: code ?? '' } : null,
      access: this.liveAccess() === 'READ_ONLY' ? 'READ_ONLY' : 'ACTIVE',
      access_reason: this.liveAccess() === 'READ_ONLY' ? 'GAME_RUNNING' : null,
      last_message: last && {
        message_id: last.message_id,
        sender_user_id: last.sender_user_id,
        text: last.text,
        sent_at: last.sent_at,
        expires_at: last.expires_at,
      },
    };
  }

  private peer(userId: number): ChannelPeer {
    return (
      mockDirectory.user(userId) ?? {
        user_id: userId,
        username: `user_${userId}`,
        avatar_url: '',
        is_online: false,
      }
    );
  }

  private directChannel(peerId: number, create: true): StoredChannel;
  private directChannel(peerId: number, create: false): StoredChannel | undefined;
  private directChannel(peerId: number, create: boolean): StoredChannel | undefined {
    const existing = [...this.channels.values()].find(
      (c) => c.type === 'DIRECT' && c.peerId === peerId,
    );
    if (existing || !create) return existing;
    const channel: StoredChannel = {
      channel_id: this.nextChannelId++,
      type: 'DIRECT',
      peerId,
      roomId: null,
      created_at: now(),
      messages: [],
    };
    this.channels.set(channel.channel_id, channel);
    this.broadcast(
      this.event('chat.channel.available', {
        channel_id: channel.channel_id,
        channel_type: 'DIRECT',
        room_id: null,
        access: this.liveAccess(),
        reason: 'DIRECT_CREATED',
        peer: this.peer(peerId),
      }),
    );
    return channel;
  }

  private roomChannel(roomId: number): StoredChannel {
    const existing = [...this.channels.values()].find(
      (c) => c.type === 'ROOM' && c.roomId === roomId,
    );
    if (existing) return existing;
    const channel: StoredChannel = {
      channel_id: this.nextRoomChannelId++,
      type: 'ROOM',
      peerId: null,
      roomId,
      created_at: now(),
      messages: [],
    };
    this.channels.set(channel.channel_id, channel);
    return channel;
  }

  private accessEvent(
    type: 'chat.channel.available' | 'chat.channel.access_changed',
    channel: StoredChannel,
    active: boolean,
    reason: ChannelAccessReason,
  ): void {
    this.broadcast(
      this.event(type, {
        channel_id: channel.channel_id,
        channel_type: 'ROOM',
        room_id: channel.roomId,
        access: active ? this.liveAccess() : 'INACTIVE',
        reason,
      }),
    );
  }

  /** Retained history for the seeded friends, so conversations open with something in them. */
  private seed(): void {
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const add = (peerId: number, lines: [number, boolean, string][]) => {
      const channel: StoredChannel = {
        channel_id: this.nextChannelId++,
        type: 'DIRECT',
        peerId,
        roomId: null,
        created_at: at(lines[0]?.[0] ?? 0),
        messages: [],
      };
      for (const [minutesAgo, fromPeer, text] of lines) {
        this.messageSeq += 1;
        const sentAt = at(minutesAgo);
        channel.messages.push({
          message_id: `msg_${String(this.messageSeq).padStart(6, '0')}`,
          channel_id: channel.channel_id,
          sender_user_id: fromPeer ? peerId : SEED_SELF_ID,
          text,
          sent_at: sentAt,
          expires_at: expiry(sentAt),
          seq: this.messageSeq,
        });
      }
      this.channels.set(channel.channel_id, channel);
    };
    add(43, [
      [26 * 60, true, 'Good game earlier!'],
      [26 * 60 - 2, false, 'Thanks, that assassin card was close.'],
      [7, true, 'Hey! Joining your room now.'],
      [6, false, 'Nice — we need one more Operative.'],
      [5, true, 'On it. Should I take Spymaster instead?'],
      [4, false, "Go Operative, I've got Spymaster."],
      [2, true, 'Ready when you are!'],
    ]);
    // A long conversation, to page through older history.
    add(
      44,
      Array.from({ length: 64 }, (_v, i): [number, boolean, string] => [
        3 * 24 * 60 - i * 40,
        i % 3 !== 0,
        `Round ${i + 1}: ${i % 2 ? 'nice clue' : 'that was close'}`,
      ]),
    );
  }

  /* ---------------------------------- events -------------------------------- */

  private event<T extends ChatServerEvent>(type: T['type'], payload: T['payload']): T {
    return { type, event_id: this.nextEventId(), sent_at: now(), payload } as T;
  }

  private error(
    requestId: string | null,
    code: WsErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ): WsErrorMessage {
    return { type: 'error', request_id: requestId, error: { code, message, details } };
  }

  private broadcast(event: unknown): void {
    const times = this.repeatNextEvent ? 2 : 1;
    this.repeatNextEvent = false;
    for (let i = 0; i < times; i += 1)
      this.endpoints.forEach((endpoint) => endpoint.deliver(event));
  }

  private nextEventId(): string {
    this.eventSeq += 1;
    return `evt_c${String(this.eventSeq).padStart(6, '0')}`;
  }
}

/** The one mock Chat Gateway / Channel Service, shared by the mock socket and mock REST. */
export const mockChat = new MockChatServer();

mockRoomLifecycle.changed = () => mockChat.syncRooms();
