import { useCallback } from 'react';

import { openDirectChat } from '@features/chat/hooks/useChat';
import { useRelationship } from '@features/friends/hooks/useRelationship';
import { ProfileModal } from '@features/profile/components/ProfileModal';
import type { InviteUnavailableReason } from '@features/profile/hooks/useInviteToRoom';
import { useRoomStore } from '@features/room/store/roomStore';
import { GameHistory } from '@features/stats/components/GameHistory';
import { useSessionStore } from '@shared/stores';

/**
 * The Profile pop-up with everything it needs from other features, joined here at app
 * level so no feature imports another: the relationship and its actions from `friends`, the room the user
 * is in from the room store, GAME HISTORY from `stats`, Message from `chat`, and the Room
 * Owner's Remove from Room, which the room screen confirms.
 *
 * The room is the live snapshot of the user's active room, so invite eligibility follows
 * every `room.state`, including the fresh one after a reconnect. Outside a room it is
 * `null` and Invite says so.
 */
export function ProfilePopup({ userId, onClose }: { userId: number; onClose: () => void }) {
  const me = useSessionStore((state) => state.user);
  const isSelf = me?.user_id === userId;

  return isSelf ? (
    <ProfileModal userId={userId} isSelf onClose={onClose} room={null} history={<GameHistory />} />
  ) : (
    <OtherProfile userId={userId} onClose={onClose} />
  );
}

function OtherProfile({ userId, onClose }: { userId: number; onClose: () => void }) {
  const friendship = useRelationship(userId);
  const activeRoomId = useSessionStore((state) => state.activeRoomId);
  const room = useRoomStore((state) =>
    state.room && state.room.room_id === activeRoomId ? state.room : null,
  );
  const { retry: rereadFriends } = friendship;

  // The server found the friend list out of date; read it again so the actions agree.
  const onInviteRefused = useCallback(
    (reason: InviteUnavailableReason) => {
      if (reason === 'NOT_FRIENDS') rereadFriends();
    },
    [rereadFriends],
  );

  // Message opens the direct chat over the same screen; the pop-up steps aside for it.
  const onMessage = useCallback(() => {
    onClose();
    openDirectChat(userId);
  }, [onClose, userId]);

  // The Room Owner removes a member: the room screen behind asks to confirm it.
  const selfId = useSessionStore((state) => state.user?.user_id);
  const canKick =
    room !== null &&
    room.status !== 'CLOSED' &&
    room.host_user_id === selfId &&
    room.players.some((p) => p.user_id === userId);
  const onKick = useCallback(() => {
    onClose();
    useRoomStore.getState().requestKick(userId);
  }, [onClose, userId]);

  return (
    <ProfileModal
      userId={userId}
      isSelf={false}
      onClose={onClose}
      friendship={friendship}
      room={room}
      onInviteRefused={onInviteRefused}
      onMessage={onMessage}
      onKick={canKick ? onKick : undefined}
    />
  );
}
