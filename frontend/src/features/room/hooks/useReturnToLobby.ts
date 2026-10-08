/**
 * Back to Lobby from a match result: `room.lobby.return`.
 *
 * Any member may return, independently of the others. The screen changes when the server's
 * recipient-specific `room.state` puts this player back in the room's lobby, never on the
 * ack alone. A return that arrives after the decision deadline is refused, and the server
 * then removes the player, which the room route explains.
 */

import { useCallback, useRef, useState } from 'react';

import { RoomCommandError } from '@shared/websocket';

import { useRoomCommands } from './useRoomCommands';

export type ReturnStatus = 'IDLE' | 'RETURNING' | 'FAILED';

export function useReturnToLobby() {
  const commands = useRoomCommands();
  const [status, setStatus] = useState<ReturnStatus>('IDLE');
  const busy = useRef(false);

  const returnToLobby = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus('RETURNING');
    try {
      // Stays RETURNING: the lobby snapshot that follows the ack replaces this screen.
      await commands.returnToLobby();
    } catch (error) {
      // A lost answer is not a refusal: the snapshot shows whether the return counted.
      const lost = error instanceof RoomCommandError && error.code === 'CONNECTION_LOST';
      setStatus(lost ? 'IDLE' : 'FAILED');
    } finally {
      busy.current = false;
    }
  }, [commands]);

  return { status, returnToLobby };
}
