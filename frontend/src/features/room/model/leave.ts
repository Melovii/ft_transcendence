/**
 * Leave semantics. All of them call the same REST `Leave room` endpoint.
 *
 * - LEAVE ROOM before the match starts gives up the member's team, role and seat.
 * - LEAVE GAME while the match runs, as a Spymaster or an Operative, adds a leave penalty
 *   to the player's profile (heavier for a Spymaster), and a team left without its
 *   Spymaster or its last Operative may close the room if nobody takes the seat in time.
 * - A member without a seat risks nothing: their LEAVE ROOM just takes them out.
 * - On a result screen nothing is at stake: EXIT leaves the room at once.
 *
 * Every leave that costs something asks first.
 */

import type { Room, RoomMember } from '@shared/types';

export type LeaveKind = 'LEAVE_ROOM' | 'LEAVE_GAME_SPYMASTER' | 'LEAVE_GAME_OPERATIVE' | 'EXIT';

export interface LeaveAction {
  kind: LeaveKind;
  /** Whether the player confirms first. */
  confirm: boolean;
}

export function leaveActionFor(room: Room | null, me: RoomMember | null): LeaveAction {
  if (me?.state === 'POST_GAME') return { kind: 'EXIT', confirm: false };
  if (room?.status === 'IN_GAME' && me?.state === 'IN_GAME' && me.role) {
    return {
      kind: me.role === 'SPYMASTER' ? 'LEAVE_GAME_SPYMASTER' : 'LEAVE_GAME_OPERATIVE',
      confirm: true,
    };
  }
  return { kind: 'LEAVE_ROOM', confirm: true };
}

/**
 * Whether leaving now, by any means (Leave, Log Out, deleting the account), takes this
 * player out of a running match they play in. Account deletion carries no penalty, but
 * the team may still be left short.
 */
export function inRunningMatch(room: Room | null, userId: number | undefined): RoomMember | null {
  const me = room?.players.find((p) => p.user_id === userId) ?? null;
  return leaveActionFor(room, me).kind.startsWith('LEAVE_GAME') ? me : null;
}
