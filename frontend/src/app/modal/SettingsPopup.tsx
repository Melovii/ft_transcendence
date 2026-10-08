import { useState } from 'react';

import { useDeleteAccount } from '@app/session/useDeleteAccount';
import { useLogOut } from '@app/session/useLogOut';
import { LogOutDialog } from '@features/auth/components/LogOutDialog';
import { DeleteAccountDialog } from '@features/profile/components/DeleteAccountDialog';
import { SettingsModal } from '@features/profile/components/SettingsModal';
import { inRunningMatch } from '@features/room/model/leave';
import { useRoomStore } from '@features/room/store/roomStore';
import { useSessionStore } from '@shared/stores';

type Confirmation = 'LOG_OUT' | 'DELETE_ACCOUNT' | null;

/**
 * Settings with what it needs from other features, joined here at app level so no feature
 * imports another: Log Out and Delete Account from the session flow, and from the room
 * store whether the user plays in a running match, where logging out counts as leaving it
 * (a leave penalty, and a team that may be left short) and is confirmed first. Delete
 * Account is always confirmed.
 */
export function SettingsPopup({ onClose }: { onClose: () => void }) {
  const { status, logOut } = useLogOut();
  const removal = useDeleteAccount();
  const [confirming, setConfirming] = useState<Confirmation>(null);
  const username = useSessionStore((state) => state.user?.username ?? '');
  const activeRoomId = useSessionStore((state) => state.activeRoomId);
  const userId = useSessionStore((state) => state.user?.user_id);
  const seat = useRoomStore((state) =>
    activeRoomId !== null && state.room?.room_id === activeRoomId
      ? inRunningMatch(state.room, userId)
      : null,
  );
  const inMatch = seat !== null;

  const cancelDelete = () => {
    removal.reset();
    setConfirming(null);
  };

  return (
    <>
      <SettingsModal
        onClose={onClose}
        active={confirming === null}
        logOut={{
          status: confirming === 'LOG_OUT' ? 'IDLE' : status,
          request: () => (inMatch ? setConfirming('LOG_OUT') : void logOut()),
        }}
        deleteAccount={{ request: () => setConfirming('DELETE_ACCOUNT') }}
      />
      {confirming === 'LOG_OUT' && (
        <LogOutDialog
          role={seat?.role === 'SPYMASTER' ? 'SPYMASTER' : 'OPERATIVE'}
          pending={status === 'PENDING'}
          failed={status === 'FAILED'}
          onConfirm={() => void logOut()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'DELETE_ACCOUNT' && (
        <DeleteAccountDialog
          username={username}
          inMatch={inMatch}
          pending={removal.status === 'PENDING'}
          failure={removal.failure}
          onConfirm={(typed) => void removal.deleteAccount(typed)}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}
