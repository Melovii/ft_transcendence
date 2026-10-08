import { useEffect } from 'react';

import { RoomInvitation } from '@features/room/components/RoomInvitation';
import * as styles from '@features/room/components/RoomInvitation.styles';
import { useInviteStore } from '@features/lobby/store/inviteStore';

/**
 * The room invitations the user has received, shown on Room Discovery, where joining a
 * room is possible. They arrive live on the chat socket and are never stored by the
 * server, so each one is dropped when its delivery deadline (`expires_at`) passes, when the
 * user dismisses it, or once its Join succeeds.
 *
 * It lives at app level because it joins the lobby's invitation store to the room
 * feature's join.
 */
export function RoomInvitations() {
  const invites = useInviteStore((state) => state.invites);
  const dismiss = useInviteStore((state) => state.dismiss);

  // Each invitation leaves the screen when it expires.
  useEffect(() => {
    const timers = invites.map((invite) =>
      setTimeout(
        () => dismiss(invite.invite_id),
        Math.max(0, Date.parse(invite.expires_at) - Date.now()),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [dismiss, invites]);

  if (invites.length === 0) return null;

  return (
    <div className={styles.stack}>
      {invites.map((invite) => (
        <RoomInvitation
          key={invite.invite_id}
          roomId={invite.room_id}
          roomCode={invite.room_code}
          fromUsername={invite.from_user.username}
          onDismiss={() => dismiss(invite.invite_id)}
        />
      ))}
    </div>
  );
}
