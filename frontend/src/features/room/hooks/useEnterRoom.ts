/**
 * The one way into a room once the server has confirmed the membership.
 *
 * Create and Join both end here with the room the server returned: it becomes the room
 * store's starting snapshot, the session's active room, and the route. The room socket then
 * takes over and keeps the store in step with the server.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { roomPath } from '@shared/constants';
import { useSessionStore } from '@shared/stores';
import type { Room } from '@shared/types';

import { useRoomStore } from '../store/roomStore';

export function useEnterRoom() {
  const navigate = useNavigate();

  return useCallback(
    (room: Room) => {
      useRoomStore.getState().applySnapshot(room);
      useSessionStore.getState().setActiveRoomId(room.room_id);
      navigate(roomPath(room.room_id));
    },
    [navigate],
  );
}

/** Return to a room the user already belongs to, as the server named it. */
export function useReturnToRoom() {
  const navigate = useNavigate();

  return useCallback(
    (roomId: number) => {
      useSessionStore.getState().setActiveRoomId(roomId);
      navigate(roomPath(roomId));
    },
    [navigate],
  );
}
