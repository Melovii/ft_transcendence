/**
 * Room invitation binding — Bruno `v2/game-rest-api/00 - Rooms/invite-friend.yml`.
 *
 * `202 Accepted` means the invitation was accepted for live delivery on the friend's chat
 * socket, not that they have seen it.
 */

import { apiRequest } from '@shared/api';
import { ROOM_API_PATH } from '@shared/constants';
import type { InviteFriendResponse } from '@shared/types';

export const inviteFriend = (roomId: number, userId: number): Promise<InviteFriendResponse> =>
  apiRequest(`${ROOM_API_PATH}/${roomId}/invites`, { method: 'POST', body: { user_id: userId } });
