/**
 * Room commands sent over the shared room socket: setup, settings, kicks and Back to Lobby.
 *
 * Each command settles when the server answers it: resolved by its ack, rejected with a
 * `RoomCommandError` carrying the error code. The answer is feedback only. Every change
 * appears when the matching events and the next `room.state` arrive, for this client and
 * every other one alike.
 */

import { useMemo } from 'react';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import type { AckMessage, PlayingRole, RoomSettings, Team } from '@shared/types';

export function useRoomCommands() {
  const connection = useRoomConnection();
  return useMemo(
    () => ({
      /** A participant moves to the other team, keeping their role where the seat allows. */
      selectTeam: (team: Team): Promise<AckMessage> =>
        connection.request('room.team.select', { team }),
      /** Claims a playing role on `team` in one step, from spectating or another role. */
      selectRole: (team: Team, role: PlayingRole): Promise<AckMessage> =>
        connection.request('room.role.select', { team, role }),
      /** Gives the seat up and watches instead. */
      spectate: (): Promise<AckMessage> =>
        connection.request('room.role.select', { role: 'SPECTATOR' }),
      setReady: (ready: boolean): Promise<AckMessage> =>
        connection.request('room.ready.set', { ready }),
      updateSettings: (settings: Partial<RoomSettings>): Promise<AckMessage> =>
        connection.request('room.settings.update', settings),
      kick: (userId: number): Promise<AckMessage> =>
        connection.request('room.member.kick', { user_id: userId }),
      returnToLobby: (): Promise<AckMessage> => connection.request('room.lobby.return', {}),
    }),
    [connection],
  );
}
