/**
 * What the Ready Room shows, read from the authoritative room snapshot.
 *
 * Nothing here decides anything the server owns. The start predicate is `room.startable`,
 * the countdown is `room.status` and the server's seconds, and every command is validated
 * again by the server; these helpers only arrange the members for display and explain why
 * a control is unavailable.
 */

import type { Room, RoomMember, Team } from '@shared/types';

/**
 * Seats drawn per team while it is short of players: a startable team needs a Spymaster
 * and at least one Operative. Only seats that can still be filled are drawn, by unseated
 * members or by players the room still has room for.
 */
const SEATS_PER_TEAM = 2;

export interface TeamRoster {
  team: Team;
  members: RoomMember[];
  /** Empty seats drawn under the members; never more than can still be filled. */
  emptySeats: number;
}

export interface Rosters {
  red: TeamRoster;
  blue: TeamRoster;
  /** Members who have not claimed a team and a role yet; the room cannot start until they do. */
  unseated: RoomMember[];
}

const byJoinOrder = (a: RoomMember, b: RoomMember): number =>
  a.joined_at.localeCompare(b.joined_at);

export function rosters(room: Room): Rosters {
  const members = [...room.players].sort(byJoinOrder);
  const red = members.filter((p) => p.team === 'RED' && isParticipant(p));
  const blue = members.filter((p) => p.team === 'BLUE' && isParticipant(p));
  const unseated = members.filter((p) => !isParticipant(p));
  let open = Math.max(0, room.max_players - room.player_count) + unseated.length;
  const seats = (count: number): number => {
    const seatsShown = Math.min(Math.max(0, SEATS_PER_TEAM - count), open);
    open -= seatsShown;
    return seatsShown;
  };
  return {
    red: { team: 'RED', members: red, emptySeats: seats(red.length) },
    blue: { team: 'BLUE', members: blue, emptySeats: seats(blue.length) },
    unseated,
  };
}

/** A member who holds a team and a role; an unseated member holds neither. */
export const isParticipant = (member: RoomMember): boolean =>
  member.role !== null && member.team !== null;

export const readyCount = (room: Room): number =>
  room.players.filter((p) => isParticipant(p) && p.ready).length;

/**
 * Members still on the last match's result. While any remain, the room accepts nobody
 * new and cannot start.
 */
export const postGamePending = (room: Room): RoomMember[] =>
  room.players.filter((p) => p.state === 'POST_GAME');

export const isFull = (room: Room): boolean => room.player_count >= room.max_players;

/**
 * The headline over the teams: the countdown, players still on the last result, a full
 * room, or still waiting.
 */
export type RoomPhase = 'COUNTDOWN' | 'POST_GAME' | 'FULL' | 'WAITING';

export function roomPhase(room: Room): RoomPhase {
  if (room.status === 'COUNTDOWN') return 'COUNTDOWN';
  if (postGamePending(room).length > 0) return 'POST_GAME';
  return isFull(room) ? 'FULL' : 'WAITING';
}

/** Team and role only change while the room is waiting; the countdown locks them. */
export const setupLocked = (room: Room): boolean => room.status !== 'WAITING';

export type ReadyState =
  | { kind: 'READY' }
  | { kind: 'AVAILABLE' }
  | {
      kind: 'UNAVAILABLE';
      reason: 'TEAM_REQUIRED' | 'ROLE_REQUIRED' | 'LOCKED' | 'POST_GAME_PENDING';
    };

/**
 * Ready needs a team and a role (`TEAM_REQUIRED`, `ROLE_REQUIRED`), a waiting room, and
 * nobody still on the last result (`POST_GAME_PENDING`).
 */
export function readyState(room: Room, me: RoomMember): ReadyState {
  if (setupLocked(room)) return { kind: 'UNAVAILABLE', reason: 'LOCKED' };
  if (me.ready) return { kind: 'READY' };
  if (!me.team) return { kind: 'UNAVAILABLE', reason: 'TEAM_REQUIRED' };
  if (!me.role) return { kind: 'UNAVAILABLE', reason: 'ROLE_REQUIRED' };
  if (postGamePending(room).length > 0) return { kind: 'UNAVAILABLE', reason: 'POST_GAME_PENDING' };
  return { kind: 'AVAILABLE' };
}

export const findMember = (room: Room, userId: number | undefined): RoomMember | null =>
  room.players.find((p) => p.user_id === userId) ?? null;
