/**
 * Room REST bindings — Bruno `v2/game-rest-api/00 - Rooms/`.
 *
 * REST owns room creation, membership and snapshots. Team, role, readiness, room settings,
 * kicks, Back to Lobby and every gameplay mutation are WebSocket-only and must not appear
 * here. These calls pair with the room socket at `/ws/v2/rooms/{room_id}`.
 */

import { apiRequest } from '@shared/api';
import { ROOM_API_PATH } from '@shared/constants';
import type { CreateRoomRequest, Room, RoomLookupResponse } from '@shared/types';

/** Creates a `WAITING` room and joins the creator as its host, spectating. */
export const createRoom = (body: CreateRoomRequest = {}): Promise<Room> =>
  apiRequest(ROOM_API_PATH, { method: 'POST', body });

/** Resolve a shareable `^[A-Z0-9]{6}$` code to a `room_id` before joining. */
export const lookupRoomByCode = (roomCode: string): Promise<RoomLookupResponse> =>
  apiRequest(`${ROOM_API_PATH}/lookup/${encodeURIComponent(roomCode)}`);

/** Every join starts as a spectator, in a waiting room or a running match. */
export const joinRoom = (roomId: number): Promise<Room> =>
  apiRequest(`${ROOM_API_PATH}/${roomId}/members`, { method: 'POST' });

/** Recipient-specific snapshot: an Operative never receives unrevealed card colors. */
export const getRoomSnapshot = (roomId: number): Promise<Room> =>
  apiRequest(`${ROOM_API_PATH}/${roomId}`);

/**
 * Legal in every room status. A participant leaving a running match receives a leave
 * penalty, and the server checks whether both teams are still staffed.
 */
export const leaveRoom = (roomId: number): Promise<void> =>
  apiRequest(`${ROOM_API_PATH}/${roomId}/members/me`, { method: 'DELETE' });
