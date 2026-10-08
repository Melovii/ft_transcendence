/**
 * Chat v2 client logic, between the Chat Gateway socket, Chat REST v2 and the chat store.
 *
 * The app-level `ChatConnectionProvider` owns the one chat socket and hands it here with
 * `attachChatConnection`; `chatEventHandlers` are the handlers it registers on that socket.
 * Components never reach this module directly: they go through the chat hooks.
 *
 * Sending: every message gets a `request_id` and shows as pending until its ack. The
 * contract makes a retry with the same `request_id` safe — Channel Service returns the
 * original result instead of storing the message again — so a message whose ack was lost
 * to a dropped connection is sent again under the same id once the gateway is ready, and
 * the user can retry a failed one the same way. A message the server refused for good is
 * never resent.
 *
 * Reconnecting: the socket replays nothing, so after every `chat.ready` that follows a
 * drop the channel list and each open conversation's newest page are read again and
 * merged by `message_id`. Messages missed while offline appear once; nothing duplicates.
 */

import type { ApiError } from '@shared/api';
import type {
  ChannelAccessChangedEvent,
  ChannelAvailableEvent,
  ChannelSummary,
  ChatMessage,
  ChatMessageCreatedEvent,
  WsErrorMessage,
} from '@shared/types';
import { createRequestId } from '@shared/utils';
import type { ChatConnection, ChatConnectionHandlers, ConnectionStatus } from '@shared/websocket';

import { getMessageHistory, listChannels, openDirectChannel } from '../api';
import { sendableText } from '../model/messages';
import { useChatStore } from '../store/chatStore';
import type { ChatChannel, SendFailure } from '../store/chatStore';

/** Newest messages read when a conversation opens or is brought up to date. */
const HISTORY_PAGE = 50;
/** The contract's largest channel-list page. */
const CHANNEL_PAGE = 100;
/** Enough pages for any realistic number of friends and one room. */
const MAX_CHANNEL_PAGES = 10;
/** A send with no ack by then is shown as not sent; retrying it is safe. */
const ACK_TIMEOUT_MS = 10_000;

let connection: ChatConnection | null = null;
/** Whether a `chat.ready` was seen on an earlier connection of this socket owner. */
let hadReady = false;
const ackTimers = new Map<string, ReturnType<typeof setTimeout>>();

const store = () => useChatStore.getState();

/** The signed-in user, as the gateway confirmed it in `chat.ready`. */
let selfId: number | null = null;

export function attachChatConnection(next: ChatConnection | null, ownerId: number | null): void {
  connection = next;
  hadReady = false;
  if (ownerId !== null) {
    selfId = ownerId;
    store().resetFor(ownerId);
  }
  if (!next) {
    store().setReady(false);
    ackTimers.forEach(clearTimeout);
    ackTimers.clear();
  }
}

/* --------------------------------- channels -------------------------------- */

function toChannel(summary: ChannelSummary): ChatChannel {
  return {
    channel_id: summary.channel_id,
    type: summary.type,
    peer: summary.peer,
    room: summary.room,
    last_message: summary.last_message,
    access: 'ACTIVE',
    reason: null,
  };
}

let channelsRequest: Promise<void> | null = null;

/** Read every accessible channel. Concurrent callers share one read. */
export function loadChannels(quiet = false): Promise<void> {
  channelsRequest ??= (async () => {
    if (!quiet) store().setChannelsStatus('LOADING');
    try {
      const all: ChannelSummary[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_CHANNEL_PAGES; page += 1) {
        const response = await listChannels({ limit: CHANNEL_PAGE, after });
        all.push(...response.channels);
        if (!response.next_cursor) break;
        after = response.next_cursor;
      }
      noteMissedPreviews(all);
      store().replaceChannels(all.map(toChannel));
    } catch {
      if (!quiet || store().channelsStatus !== 'READY') store().setChannelsStatus('ERROR');
    } finally {
      channelsRequest = null;
    }
  })();
  return channelsRequest;
}

/**
 * A channel whose newest message changed while this tab could not hear it, and whose
 * conversation is not loaded to count exactly, is marked as having something new.
 */
function noteMissedPreviews(list: ChannelSummary[]): void {
  const { channels, histories, unread } = store();
  for (const summary of list) {
    const last = summary.last_message;
    const known = channels[summary.channel_id];
    if (!last || !known || last.sender_user_id === selfId) continue;
    if (known.last_message?.message_id === last.message_id) continue;
    if (histories[summary.channel_id]?.status === 'READY') continue;
    if (isViewing(summary.channel_id) || unread[summary.channel_id]) continue;
    store().bumpUnread(summary.channel_id);
  }
}

/* ---------------------------------- history -------------------------------- */

const historyRequests = new Map<number, Promise<void>>();

/**
 * Read a conversation's newest page. The first read replaces the conversation; later ones
 * (after a reconnect or regained access) merge into it. When the fresh page does not reach
 * back to what was already known, the gap cannot be trusted, so the conversation restarts
 * from the fresh page.
 */
export function loadHistory(channelId: number): Promise<void> {
  const running = historyRequests.get(channelId);
  if (running) return running;
  const request = (async () => {
    const before = store().histories[channelId];
    const hadMessages = before?.status === 'READY';
    if (!hadMessages) store().setHistory(channelId, { status: 'LOADING' });
    try {
      const page = await getMessageHistory(channelId, { limit: HISTORY_PAGE });
      const fresh = [...page.messages].reverse();
      const current = store().histories[channelId];
      if (store().channels[channelId]?.access === 'INACTIVE') return;
      if (current?.status === 'READY' && current.messages.length > 0) {
        const known = new Set(current.messages.map((m) => m.message_id));
        const overlaps = page.next_cursor === null || fresh.some((m) => known.has(m.message_id));
        const added = fresh.filter((m) => !known.has(m.message_id));
        if (!overlaps) store().setHistory(channelId, { messages: [], cursor: page.next_cursor });
        store().addMessages(channelId, fresh);
        const missed = added.filter((m) => m.sender_user_id !== selfId).length;
        if (missed > 0 && !isViewing(channelId)) store().bumpUnread(channelId, missed);
      } else {
        store().setHistory(channelId, {
          messages: fresh,
          cursor: page.next_cursor,
          status: 'READY',
          loadingOlder: false,
          olderFailed: false,
        });
        store().addMessages(channelId, fresh);
      }
    } catch (cause) {
      if (isAccessError(cause)) {
        store().setAccess(channelId, 'INACTIVE', null);
      } else if (!hadMessages) {
        store().setHistory(channelId, { status: 'ERROR' });
      }
    } finally {
      historyRequests.delete(channelId);
    }
  })();
  historyRequests.set(channelId, request);
  return request;
}

/** Read the page before the oldest loaded message. */
export async function loadOlder(channelId: number): Promise<void> {
  const history = store().histories[channelId];
  if (!history || history.status !== 'READY' || history.loadingOlder || !history.cursor) return;
  store().setHistory(channelId, { loadingOlder: true, olderFailed: false });
  try {
    const page = await getMessageHistory(channelId, {
      limit: HISTORY_PAGE,
      before: history.cursor,
    });
    store().prependOlder(channelId, page.messages, page.next_cursor);
  } catch (cause) {
    if (isAccessError(cause)) store().setAccess(channelId, 'INACTIVE', null);
    else store().setHistory(channelId, { loadingOlder: false, olderFailed: true });
  }
}

const isAccessError = (cause: unknown): boolean =>
  ['CHANNEL_ACCESS_REVOKED', 'NOT_CHANNEL_MEMBER', 'CHANNEL_NOT_FOUND', 'NOT_PERMITTED'].includes(
    (cause as ApiError)?.code,
  );

/* ------------------------------ opening a chat ----------------------------- */

function isViewing(channelId: number): boolean {
  const { isOpen, view } = store();
  return (
    isOpen &&
    view.kind === 'CHANNEL' &&
    view.channelId === channelId &&
    (typeof document === 'undefined' || document.visibilityState === 'visible')
  );
}

/** Show a channel's conversation, reading its history if it is not loaded yet. */
export function showChannel(channelId: number): void {
  store().open({ kind: 'CHANNEL', channelId });
  store().clearUnread(channelId);
  const history = store().histories[channelId];
  if (!history || history.status === 'IDLE' || history.status === 'ERROR') {
    void loadHistory(channelId);
  }
}

/** The viewer is looking at `channelId` again (tab visible, panel open): nothing is unread. */
export function markSeen(channelId: number): void {
  if (isViewing(channelId)) store().clearUnread(channelId);
}

/**
 * Open the direct conversation with a friend. The channel is resolved over REST, which
 * the server allows for current friends only.
 */
export async function openDirect(peerUserId: number): Promise<void> {
  const known = Object.values(store().channels).find(
    (c) => c.type === 'DIRECT' && c.peer?.user_id === peerUserId && c.access === 'ACTIVE',
  );
  if (known) {
    showChannel(known.channel_id);
    return;
  }
  if (store().openingPeerId === peerUserId) return;
  store().open();
  store().setOpening(peerUserId);
  try {
    const channel = await openDirectChannel(peerUserId);
    store().upsertChannel({
      channel_id: channel.channel_id,
      type: 'DIRECT',
      peer: channel.peer,
      room: null,
      last_message: null,
      access: 'ACTIVE',
      reason: null,
    });
    store().setOpening(null);
    showChannel(channel.channel_id);
  } catch {
    store().setOpening(null, true);
  }
}

/* ---------------------------------- sending -------------------------------- */

function startAckTimer(requestId: string): void {
  clearTimeout(ackTimers.get(requestId));
  ackTimers.set(
    requestId,
    setTimeout(() => {
      ackTimers.delete(requestId);
      const pending = store().pending[requestId];
      // Already seen as persisted: the ack was lost, not the message.
      if (pending?.settled_message_id) store().removePending(requestId);
      else if (pending?.status === 'SENDING') {
        store().updatePending(requestId, { status: 'FAILED', failure: 'TIMEOUT' });
      }
    }, ACK_TIMEOUT_MS),
  );
}

function transmit(requestId: string): void {
  const pending = store().pending[requestId];
  if (!pending) return;
  const sent =
    store().ready &&
    connection !== null &&
    connection.send({ channel_id: pending.channel_id, text: pending.text }, requestId);
  if (!sent) {
    store().updatePending(requestId, { status: 'FAILED', failure: 'OFFLINE' });
    return;
  }
  store().updatePending(requestId, { status: 'SENDING', failure: null });
  startAckTimer(requestId);
}

/**
 * Send `draft` to `channelId`. Returns `false`, sending nothing, when the draft is empty or
 * too long. The message shows as pending until the server acknowledges it.
 */
export function sendMessage(channelId: number, draft: string): boolean {
  const text = sendableText(draft);
  if (text === null) return false;
  const requestId = createRequestId();
  store().addPending({
    request_id: requestId,
    channel_id: channelId,
    text,
    created_at: new Date().toISOString(),
    status: 'SENDING',
    failure: null,
    settled_message_id: null,
  });
  transmit(requestId);
  return true;
}

const RETRYABLE: readonly SendFailure[] = ['OFFLINE', 'TIMEOUT', 'UNAVAILABLE'];

/** Send a failed message again under its original `request_id`, so it is stored once. */
export function retryMessage(requestId: string): void {
  const pending = store().pending[requestId];
  if (!pending || pending.status !== 'FAILED') return;
  if (pending.failure && !RETRYABLE.includes(pending.failure)) return;
  transmit(requestId);
}

/** Forget a message that was not sent. */
export function discardMessage(requestId: string): void {
  clearTimeout(ackTimers.get(requestId));
  ackTimers.delete(requestId);
  store().removePending(requestId);
}

/* ------------------------------ socket events ------------------------------ */

function onStatusChange(status: ConnectionStatus): void {
  if (status !== 'OPEN') store().setReady(false);
}

function onReady(): void {
  const reconnected = hadReady;
  hadReady = true;
  store().setReady(true);
  void loadChannels(reconnected).then(() => {
    if (!reconnected) return;
    // Bring every conversation already on screen up to date.
    for (const [id, history] of Object.entries(store().histories)) {
      if (history.status === 'READY') void loadHistory(Number(id));
    }
  });
  // A message that was in flight when the connection dropped has an unknown outcome.
  // Sending it again under the same `request_id` returns the original result.
  for (const pending of Object.values(store().pending)) {
    if (pending.settled_message_id) discardMessage(pending.request_id);
    else if (pending.status === 'SENDING') transmit(pending.request_id);
  }
}

/**
 * Message ids already delivered live, so a redelivered event is neither counted as unread
 * twice nor matched to a second pending copy, even while its conversation is not loaded.
 * Bounded: only recent ids can repeat.
 */
const delivered = new Set<string>();
const DELIVERED_LIMIT = 500;

function firstDelivery(messageId: string): boolean {
  if (delivered.has(messageId)) return false;
  delivered.add(messageId);
  if (delivered.size > DELIVERED_LIMIT) {
    const oldest = delivered.values().next().value;
    if (oldest !== undefined) delivered.delete(oldest);
  }
  return true;
}

function onMessage(event: ChatMessageCreatedEvent): void {
  const message: ChatMessage = { ...event.payload, sent_at: event.sent_at };
  const channelId = message.channel_id;
  if (!store().channels[channelId]) void loadChannels(true);

  const history = store().histories[channelId];
  const isNew =
    firstDelivery(message.message_id) &&
    !history?.messages.some((m) => m.message_id === message.message_id);

  if (!isNew) {
    // Already shown (a redelivery, or the ack got here first): merging it is a no-op.
    store().addMessages(channelId, [message]);
    return;
  }

  if (message.sender_user_id === selfId) {
    // Our own message, possibly before its ack: settle the oldest matching pending copy so
    // the conversation shows the persisted message once.
    const match = Object.values(store().pending)
      .filter(
        (p) =>
          p.channel_id === channelId &&
          p.status === 'SENDING' &&
          !p.settled_message_id &&
          p.text === message.text,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (match) store().updatePending(match.request_id, { settled_message_id: message.message_id });
  } else if (!isViewing(channelId)) {
    store().bumpUnread(channelId);
  }
  store().addMessages(channelId, [message]);
}

function onChannelAvailable(event: ChannelAvailableEvent): void {
  const { payload } = event;
  store().upsertChannel({
    channel_id: payload.channel_id,
    type: payload.channel_type,
    peer: payload.peer ?? null,
    room: payload.room_id === null ? null : { room_id: payload.room_id, room_code: null },
    last_message: null,
    access: payload.access,
    reason: payload.reason,
  });
  // The list carries what the event does not: the room code and the latest message.
  void loadChannels(true);
}

function onAccessChanged(event: ChannelAccessChangedEvent): void {
  const { channel_id: channelId, access, reason } = event.payload;
  if (!store().channels[channelId]) {
    if (access === 'ACTIVE') void loadChannels(true);
    return;
  }
  store().setAccess(channelId, access, reason);
  if (access === 'INACTIVE') {
    // Nothing more can be sent here; say so on anything still waiting.
    for (const pending of Object.values(store().pending)) {
      if (pending.channel_id === channelId && !pending.settled_message_id) {
        clearTimeout(ackTimers.get(pending.request_id));
        store().updatePending(pending.request_id, { status: 'FAILED', failure: 'REVOKED' });
      }
    }
  } else if (isViewing(channelId)) {
    // Regained access opens a new visibility window: read what is visible now.
    void loadHistory(channelId);
  }
}

function onAck(requestId: string, message: ChatMessage): void {
  clearTimeout(ackTimers.get(requestId));
  ackTimers.delete(requestId);
  store().removePending(requestId);
  store().addMessages(message.channel_id, [message]);
}

function onError(error: WsErrorMessage): void {
  const requestId = error.request_id;
  const pending = requestId ? store().pending[requestId] : undefined;
  if (!requestId || !pending) return;
  clearTimeout(ackTimers.get(requestId));
  ackTimers.delete(requestId);
  switch (error.error.code) {
    case 'SERVICE_UNAVAILABLE':
      store().updatePending(requestId, { status: 'FAILED', failure: 'UNAVAILABLE' });
      return;
    case 'CHANNEL_ACCESS_REVOKED':
    case 'NOT_CHANNEL_MEMBER':
    case 'CHANNEL_NOT_FOUND':
      store().updatePending(requestId, { status: 'FAILED', failure: 'REVOKED' });
      store().setAccess(pending.channel_id, 'INACTIVE', null);
      void loadChannels(true);
      return;
    default:
      store().updatePending(requestId, { status: 'FAILED', failure: 'INVALID' });
  }
}

/** Handlers the app-level provider registers on the chat socket. */
export const chatEventHandlers: Pick<
  ChatConnectionHandlers,
  'onReady' | 'onMessage' | 'onChannelAvailable' | 'onAccessChanged' | 'onAck' | 'onError'
> & { onStatusChange: (status: ConnectionStatus) => void } = {
  onStatusChange,
  onReady: (event) => {
    selfId = event.payload.user_id;
    onReady();
  },
  onMessage,
  onChannelAvailable,
  onAccessChanged,
  onAck: (ack) => {
    const pending = store().pending[ack.request_id];
    if (!pending || selfId === null) return;
    onAck(ack.request_id, {
      message_id: ack.payload.message_id,
      channel_id: ack.payload.channel_id,
      sender_user_id: selfId,
      text: pending.text,
      sent_at: ack.payload.sent_at,
      expires_at: ack.payload.expires_at,
    });
  },
  onError,
};
