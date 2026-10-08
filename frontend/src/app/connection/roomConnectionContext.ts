import { createContext, useContext } from 'react';

import type { RoomConnection } from '@shared/websocket';

/** Context for the single room WebSocket owned by `RoomConnectionProvider`. */
export const RoomConnectionContext = createContext<RoomConnection | null>(null);

/**
 * Read the one room connection. Room and Game both use this — neither opens its own
 * socket, because two sockets would mean two competing views of authoritative state.
 */
export function useRoomConnection(): RoomConnection {
  const connection = useContext(RoomConnectionContext);
  if (!connection) {
    throw new Error('useRoomConnection must be used inside RoomConnectionProvider.');
  }
  return connection;
}
