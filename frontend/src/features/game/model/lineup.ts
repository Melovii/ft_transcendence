/**
 * Each team's lineup for the match, in join order, from the room's member list. Roles are
 * fixed once the match starts, so this is the lineup for the whole game.
 */

import type { RoomMember, Team } from '@shared/types';

export interface TeamLineup {
  team: Team;
  spymasters: RoomMember[];
  operatives: RoomMember[];
}

/** The match's lineup per team, in join order, from the room's member list. */
export function lineupOf(players: readonly RoomMember[], team: Team): TeamLineup {
  const members = players.filter((p) => p.team === team);
  return {
    team,
    spymasters: members.filter((p) => p.role === 'SPYMASTER'),
    operatives: members.filter((p) => p.role === 'OPERATIVE'),
  };
}
