import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';

import { useGameStore } from '@features/game/store/gameStore';
import { useRoomStore } from '@features/room/store/roomStore';
import { ROUTES } from '@shared/constants';
import { useConnectionStore, useSessionStore } from '@shared/stores';
import { RoomConnection } from '@shared/websocket';

import { RoomConnectionContext } from './roomConnectionContext';
import { RoomRecovery } from './roomRecovery';

/**
 * The one owner of the room WebSocket.
 *
 * That socket carries both `room.*` and `game.*` events, so exactly one connection
 * exists per room and both features read from it. Room and Game must never open their
 * own socket — two sockets would mean two competing views of authoritative state.
 *
 * This provider owns transport lifecycle, publishes connection status, and forwards
 * every event to the room and game stores. Leaving the room unmounts it, which closes
 * the socket and clears both stores so no stale member state survives the exit.
 *
 * It also owns recovery (`RoomRecovery`): a drop keeps the room on screen under the
 * Reconnecting overlay while the socket retries, and every reconnect rebuilds the room
 * from the server's fresh snapshot. When the room cannot be restored in time, the
 * player's room state is dropped and they go back to Room Discovery, where the
 * Disconnected notice says what happened. Their session is kept: a lost socket is not a
 * lost login.
 */
export function RoomConnectionProvider() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const navigate = useNavigate();
  const [connection, setConnection] = useState<RoomConnection | null>(null);

  const isValidRoomId = Number.isInteger(roomId) && roomId > 0;

  useEffect(() => {
    if (!isValidRoomId) return;
    const { setRoomStatus, setRoomRecovery, setRoomLost } = useConnectionStore.getState();
    // Entering a room answers any notice left from the last one.
    setRoomLost(false);

    const recovery = new RoomRecovery({
      roomId,
      userId: () => useSessionStore.getState().user?.user_id,
      roomStatus: () => useRoomStore.getState().room?.status,
      postGameDeadline: () => {
        const { room, clockOffsetMs } = useRoomStore.getState();
        const self = room?.players.find(
          (p) => p.user_id === useSessionStore.getState().user?.user_id,
        );
        if (self?.state !== 'POST_GAME' || !room?.post_game) return null;
        return Date.parse(room.post_game.deadline_at) - clockOffsetMs;
      },
      close: (reason) => instance.close(reason),
      onRecovery: setRoomRecovery,
      onLost: () => {
        instance.disconnect();
        // Cleared first, so the room's guard does not hold the way out for a confirmation.
        useSessionStore.getState().setActiveRoomId(null);
        setRoomLost(true);
        navigate(ROUTES.lobby, { replace: true });
      },
    });

    const instance = new RoomConnection(roomId, {
      onStatusChange: (status, reason) => {
        recovery.handleStatus(status, reason);
        setRoomStatus(status, reason);
      },
      onEvent: (event) => {
        useRoomStore.getState().applyEvent(event);
        useGameStore.getState().applyEvent(event);
      },
      // A suspected gap: drop local state and reconnect for a fresh `room.state`.
      onSnapshotRequired: () => instance.resync(),
    });

    setConnection(instance);
    instance.connect();

    return () => {
      recovery.dispose();
      instance.disconnect();
      setRoomRecovery(null);
      useRoomStore.getState().clear();
      useGameStore.getState().clear();
      setConnection(null);
    };
  }, [isValidRoomId, navigate, roomId]);

  const value = useMemo(() => connection, [connection]);

  // An unusable room id sends the user back to the Lobby.
  if (!isValidRoomId) return <Navigate to={ROUTES.lobby} replace />;

  if (!value) return null;

  return (
    <RoomConnectionContext.Provider value={value}>
      <Outlet />
    </RoomConnectionContext.Provider>
  );
}
