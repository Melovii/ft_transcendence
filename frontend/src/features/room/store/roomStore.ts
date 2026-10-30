/**
 * Room domain store — temporary, room-scoped state only.
 *
 * It is written exclusively from authoritative server snapshots and events delivered by
 * the shared room connection. It never derives state the server already sends, and it
 * is cleared when the member leaves or the room closes.
 */

import { create } from 'zustand';

import { useSessionStore } from '@shared/stores';
import type { CountdownCancelReason, Room, RoomServerEvent } from '@shared/types';

/** The last countdown the server cancelled, and who caused it, for the waiting view. */
export interface CountdownCancellation {
  reason: CountdownCancelReason;
  userId: number;
  /** Read from the member list when the event arrived; `null` if they were unknown. */
  username: string | null;
  /** The cancelling event's id, so the same notice is never shown twice. */
  eventId: string;
}

/**
 * Why the server ended this player's membership, told just before it closed the socket:
 * the host removed them, their result screen timed out, the paused match they joined
 * resumed before they took a seat, or the room shut down because a team stayed short of
 * players.
 */
export type RoomExit = 'KICKED' | 'POST_GAME_TIMEOUT' | 'SEAT_UNAVAILABLE' | 'INSUFFICIENT_PLAYERS';

interface RoomState {
  room: Room | null;
  /** Server-driven countdown value; the frontend never runs its own start timer. */
  secondsRemaining: number | null;
  countdownCancellation: CountdownCancellation | null;
  /**
   * The server's clock minus this device's, from the latest event's `sent_at`. Deadlines
   * the server sends as absolute times are counted down with it, so a device whose clock
   * is off still shows the server's remaining time.
   */
  clockOffsetMs: number;
  exit: RoomExit | null;
  /**
   * A member the Room Owner asked to remove from somewhere outside the room screen (their
   * profile pop-up). The room screen picks it up and asks for confirmation.
   */
  kickRequest: number | null;

  applySnapshot: (room: Room) => void;
  /** Apply one room-stream event. `game.*` deltas belong to the game store. */
  applyEvent: (event: RoomServerEvent) => void;
  requestKick: (userId: number | null) => void;
  clear: () => void;
}

const initial = {
  room: null,
  secondsRemaining: null,
  countdownCancellation: null,
  clockOffsetMs: 0,
  exit: null,
  kickRequest: null,
} satisfies Partial<RoomState>;

export const useRoomStore = create<RoomState>((set, get) => ({
  ...initial,

  applySnapshot: (room) =>
    set({ room, secondsRemaining: room.countdown?.seconds_remaining ?? null }),

  applyEvent: (event) => {
    const sentAt = Date.parse(event.sent_at);
    if (!Number.isNaN(sentAt)) set({ clockOffsetMs: sentAt - Date.now() });

    const { room } = get();
    const patch = (next: Partial<Room>) => {
      if (room) set({ room: { ...room, ...next } });
    };

    switch (event.type) {
      case 'room.state':
      case 'game.started':
        get().applySnapshot(event.payload.room);
        return;
      case 'room.countdown.started':
        set({ secondsRemaining: event.payload.seconds_remaining, countdownCancellation: null });
        return;
      case 'room.countdown.tick':
        set({ secondsRemaining: event.payload.seconds_remaining });
        return;
      case 'room.countdown.cancelled': {
        const userId = event.payload.changed_by_user_id;
        set({
          secondsRemaining: null,
          countdownCancellation: {
            reason: event.payload.reason,
            userId,
            username: room?.players.find((p) => p.user_id === userId)?.username ?? null,
            eventId: event.event_id,
          },
        });
        return;
      }
      case 'room.settings.updated': {
        const { max_players, turn_timer_seconds, language, player_count } = event.payload;
        patch({ max_players, turn_timer_seconds, language, player_count });
        return;
      }
      case 'room.player.updated': {
        if (!room) return;
        const { player } = event.payload;
        patch({
          status: event.payload.room_status,
          startable: event.payload.startable,
          players: room.players.map((p) => (p.user_id === player.user_id ? player : p)),
        });
        return;
      }
      case 'room.player.joined':
      case 'room.player.left': {
        // Membership deltas are followed by a `room.state` snapshot, which carries the
        // authoritative member list; only the count, status and host are applied early.
        patch({
          player_count: event.payload.player_count,
          status: event.payload.room_status,
          host_user_id: event.payload.host_user_id,
        });
        if (event.type === 'room.player.left') {
          const self = useSessionStore.getState().user?.user_id;
          if (event.payload.player.user_id !== self) return;
          if (event.payload.reason === 'KICKED_BY_HOST') set({ exit: 'KICKED' });
          if (event.payload.reason === 'POST_GAME_TIMEOUT') set({ exit: 'POST_GAME_TIMEOUT' });
          if (event.payload.reason === 'SEAT_UNAVAILABLE') set({ exit: 'SEAT_UNAVAILABLE' });
        }
        return;
      }
      case 'room.player.returned_to_lobby':
        patch({ status: event.payload.room_status });
        return;
      case 'room.post_game.started':
        patch({
          status: 'POST_GAME',
          post_game: {
            deadline_at: event.payload.deadline_at,
            pending_user_ids: event.payload.pending_user_ids,
          },
        });
        return;
      case 'room.post_game.completed':
        if (room) {
          const next: Room = { ...room, status: event.payload.room_status };
          delete next.post_game;
          set({ room: next });
        }
        return;
      case 'game.ended':
        patch({
          status: 'POST_GAME',
          post_game: {
            deadline_at: event.payload.post_game_deadline_at,
            pending_user_ids: room?.players.map((p) => p.user_id) ?? [],
          },
        });
        return;
      case 'game.cancelled':
        // `room.closed` follows; the reason is known already, before the room goes.
        patch({ status: 'CLOSED' });
        set({ exit: 'INSUFFICIENT_PLAYERS' });
        return;
      case 'room.closed':
        patch({ status: 'CLOSED' });
        set({ exit: event.payload.reason });
        return;
      default:
        return;
    }
  },

  requestKick: (kickRequest) => set({ kickRequest }),

  clear: () => set(initial),
}));
