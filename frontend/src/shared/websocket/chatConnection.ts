/**
 * The per-user Chat Gateway socket (`/ws/v2/channels`), independent of any room.
 *
 * Same cookie-only authentication as the room socket. The socket carries live messages,
 * channel access changes, room invitations and social events (friend requests,
 * friendship changes and profile changes); it replays nothing on connect, so history
 * and the channel list are read over Chat REST v2 after each `chat.ready`.
 */

import { WS_CHAT_PATH } from '@shared/constants';
import type {
  AckMessage,
  ChannelAccessChangedEvent,
  ChannelAvailableEvent,
  ChatCommand,
  ChatMessageCreatedEvent,
  ChatReadyEvent,
  ChatSendAck,
  ChatSendPayload,
  ChatServerMessage,
  RoomInviteReceivedEvent,
  SocialEvent,
  WsErrorMessage,
} from '@shared/types';

import type { ConnectionCloseReason, ConnectionStatus } from './connectionState';
import { createTransport } from './transport';
import type { SocketTransport } from './transport';

export interface ChatConnectionHandlers {
  onStatusChange?: (status: ConnectionStatus, reason?: ConnectionCloseReason) => void;
  /** The gateway accepted the session; emitted once per (re)connection. */
  onReady?: (event: ChatReadyEvent) => void;
  onMessage?: (event: ChatMessageCreatedEvent) => void;
  onChannelAvailable?: (event: ChannelAvailableEvent) => void;
  onAccessChanged?: (event: ChannelAccessChangedEvent) => void;
  /** Live room invitation from a friend. Accepting it is an ordinary REST join. */
  onInvite?: (event: RoomInviteReceivedEvent) => void;
  /** A friend request or friendship changed. */
  onSocial?: (event: SocialEvent) => void;
  /** Sent only after Channel Service authorized and persisted the message. */
  onAck?: (ack: AckMessage<ChatSendAck>) => void;
  onError?: (error: WsErrorMessage) => void;
}

export class ChatConnection {
  private readonly socket: SocketTransport<ChatCommand>;

  private readonly handlers: ChatConnectionHandlers;

  constructor(handlers: ChatConnectionHandlers = {}) {
    this.handlers = handlers;
    this.socket = createTransport<ChatServerMessage, ChatCommand>({
      name: 'chat',
      path: WS_CHAT_PATH,
      onStatusChange: (status, reason) => this.handlers.onStatusChange?.(status, reason),
      onMessage: (message) => this.dispatch(message),
    });
  }

  connect(): void {
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  getStatus(): ConnectionStatus {
    return this.socket.getStatus();
  }

  /**
   * Send one message under `requestId`. A retry of a message whose outcome is unknown
   * reuses its `request_id`: Channel Service then returns the original result instead of
   * storing the message twice. Returns `false` when the socket is not open.
   */
  send(payload: ChatSendPayload, requestId: string): boolean {
    return this.socket.send({ type: 'chat.message.send', request_id: requestId, payload });
  }

  private dispatch(message: ChatServerMessage): void {
    switch (message.type) {
      case 'ack':
        this.handlers.onAck?.(message);
        return;
      case 'error':
        this.handlers.onError?.(message);
        return;
      case 'chat.ready':
        this.handlers.onReady?.(message);
        return;
      case 'chat.message.created':
        this.handlers.onMessage?.(message);
        return;
      case 'chat.channel.available':
        this.handlers.onChannelAvailable?.(message);
        return;
      case 'chat.channel.access_changed':
        this.handlers.onAccessChanged?.(message);
        return;
      case 'room.invite.received':
        this.handlers.onInvite?.(message);
        return;
      case 'friend.request.received':
      case 'friend.request.resolved':
      case 'friend.removed':
      case 'friend.restored':
      case 'user.profile.updated':
        this.handlers.onSocial?.(message);
    }
  }
}
