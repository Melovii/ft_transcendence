/**
 * Room capacity rules as the contract defines them (`ROOM_CAPACITY`). The server
 * enforces every one of them; these helpers only decide what the UI offers.
 */

import { ROOM_CAPACITY } from '@shared/types';
import type { Room, RoomLookupResponse } from '@shared/types';

export const isRoomFull = (room: Pick<Room, 'player_count' | 'max_players'>): boolean =>
  room.player_count >= room.max_players;

/** Capacities the host may switch to right now: never below the current membership. */
export const settingsCapacityOptions = (room: Pick<Room, 'player_count'>): number[] =>
  range(Math.max(ROOM_CAPACITY.min, room.player_count), ROOM_CAPACITY.max);

export interface RoomSettingsAccess {
  editable: boolean;
  /** Why the control is read-only, for the disabled-state hint. */
  reason: 'NOT_HOST' | 'NOT_WAITING' | null;
}

/** Only the host changes the settings, while the room waits and the host is in its lobby. */
export function roomSettingsAccess(room: Room, userId: number): RoomSettingsAccess {
  if (room.host_user_id !== userId) return { editable: false, reason: 'NOT_HOST' };
  const host = room.players.find((p) => p.user_id === userId);
  if (room.status !== 'WAITING' || host?.state !== 'IN_LOBBY') {
    return { editable: false, reason: 'NOT_WAITING' };
  }
  return { editable: true, reason: null };
}

/**
 * Join-dialog verdict from a code lookup, before the Join request is sent. A room that is
 * counting down or playing still takes players, who join it as spectators
 * (`IN_PROGRESS`); one whose members are still on a result takes nobody.
 */
export type JoinAvailability = 'JOINABLE' | 'IN_PROGRESS' | 'FULL' | 'NOT_JOINABLE';

export function joinAvailability(lookup: RoomLookupResponse): JoinAvailability {
  if (isRoomFull(lookup)) return 'FULL';
  if (lookup.status === 'COUNTDOWN' || lookup.status === 'IN_GAME') return 'IN_PROGRESS';
  return lookup.joinable ? 'JOINABLE' : 'NOT_JOINABLE';
}

/** Whether Join may be sent for this verdict; the server decides again. */
export const canJoin = (availability: JoinAvailability): boolean =>
  availability === 'JOINABLE' || availability === 'IN_PROGRESS';

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}
