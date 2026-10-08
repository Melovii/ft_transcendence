/**
 * Role-selection state for the lobby's SPYMASTER / OPERATIVE selector.
 *
 * Every member joins as a spectator. A spectator becomes a participant by claiming a team
 * and a playing role together (`room.role.select` with both), so the team a spectator
 * picks first is only a draft until a role is chosen with it. A participant changes team
 * or role one at a time. One Spymaster per team, and changes only while the room waits.
 * The helpers mirror those rules so the UI can say why an option is unavailable; the
 * server still validates every command.
 */

import type { PlayingRole, Room, RoomMember, Team } from '@shared/types';

export type RoleUnavailableReason =
  | 'TEAM_REQUIRED'
  /** Another member of the same team already holds the Spymaster seat. */
  | 'SPYMASTER_TAKEN'
  /** The room is no longer waiting; roles are locked. */
  | 'LOCKED';

export interface RoleOption {
  role: PlayingRole;
  selected: boolean;
  available: boolean;
  reason: RoleUnavailableReason | null;
  /** The member occupying the Spymaster seat, when `reason` is `SPYMASTER_TAKEN`. */
  occupiedBy: RoomMember | null;
}

export interface RoleSelection {
  /** The team the role options are for: the member's own, or a spectator's draft. */
  team: Team | null;
  spectating: boolean;
  /** Ready means the selection is confirmed; changing role clears it. */
  confirmed: boolean;
  changeable: boolean;
  options: [RoleOption, RoleOption];
}

/** The member holding `team`'s Spymaster seat, other than `userId`. */
export function spymasterOf(room: Room, team: Team, userId?: number): RoomMember | null {
  return (
    room.players.find((p) => p.team === team && p.role === 'SPYMASTER' && p.user_id !== userId) ??
    null
  );
}

export function roleSelection(
  room: Room,
  userId: number,
  draftTeam: Team | null = null,
): RoleSelection | null {
  const me = room.players.find((p) => p.user_id === userId);
  if (!me) return null;
  const locked = room.status !== 'WAITING';
  const spectating = me.role === 'SPECTATOR';
  const team = spectating ? draftTeam : me.team;

  const option = (role: PlayingRole): RoleOption => {
    const holder = role === 'SPYMASTER' && team ? spymasterOf(room, team, userId) : null;
    let reason: RoleUnavailableReason | null = null;
    if (locked) reason = 'LOCKED';
    else if (!team) reason = 'TEAM_REQUIRED';
    else if (holder) reason = 'SPYMASTER_TAKEN';
    return {
      role,
      selected: me.role === role,
      available: reason === null,
      reason,
      occupiedBy: holder,
    };
  };

  return {
    team,
    spectating,
    confirmed: me.ready,
    changeable: !locked,
    options: [option('SPYMASTER'), option('OPERATIVE')],
  };
}
