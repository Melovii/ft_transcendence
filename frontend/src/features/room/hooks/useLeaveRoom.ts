/**
 * LEAVE ROOM / LEAVE GAME / EXIT flow.
 *
 * `request()` opens the confirmation step where the leave costs something, and leaves at
 * once where it does not (Exit from a result); `confirm()` leaves. Leaving a running match
 * as a Spymaster or an Operative adds a leave penalty, which the confirmation states
 * before the request is sent. On success the room socket is closed, room and game state
 * are cleared, the session's active room is reset, and the user lands on the Lobby.
 * Remaining members learn about it from the server (`room.player.left`, and
 * `game.staffing.required` when a team is left short), so nothing else is sent.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import type { ApiError } from '@shared/api';
import { ROUTES } from '@shared/constants';
import { useSessionStore } from '@shared/stores';

import { leaveRoom } from '../api';
import { leaveActionFor } from '../model/leave';
import type { LeaveAction } from '../model/leave';
import { useRoomStore } from '../store/roomStore';

export type LeaveStatus = 'IDLE' | 'CONFIRMING' | 'LEAVING' | 'FAILED';

export function useLeaveRoom() {
  const connection = useRoomConnection();
  const navigate = useNavigate();
  const room = useRoomStore((state) => state.room);
  const userId = useSessionStore((state) => state.user?.user_id);
  const me = room?.players.find((p) => p.user_id === userId) ?? null;
  const [status, setStatus] = useState<LeaveStatus>('IDLE');
  const [error, setError] = useState<ApiError | null>(null);
  const action: LeaveAction = leaveActionFor(room, me);

  const leave = useCallback(async () => {
    setStatus('LEAVING');
    setError(null);
    try {
      await leaveRoom(connection.roomId);
    } catch (cause) {
      const apiError = cause as ApiError;
      // Not a member any more means the leave already happened; finish the cleanup.
      if (apiError.code !== 'NOT_ROOM_MEMBER' && apiError.code !== 'ROOM_NOT_FOUND') {
        setError(apiError);
        setStatus('FAILED');
        return;
      }
    }
    connection.disconnect();
    // Room and game stores are cleared by `RoomConnectionProvider` when it unmounts.
    useSessionStore.getState().setActiveRoomId(null);
    setStatus('IDLE');
    navigate(ROUTES.lobby, { replace: true });
  }, [connection, navigate]);

  const request = useCallback(() => {
    if (action.confirm) setStatus('CONFIRMING');
    else void leave();
  }, [action.confirm, leave]);

  const cancel = useCallback(() => setStatus('IDLE'), []);

  return { action, status, error, request, confirm: leave, cancel };
}
