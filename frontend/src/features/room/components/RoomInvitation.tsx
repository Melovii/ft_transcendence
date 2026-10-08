import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon } from '@shared/ui';

import { useJoinInvite } from '../hooks/useJoinInvite';
import * as styles from './RoomInvitation.styles';

export interface RoomInvitationProps {
  roomId: number;
  roomCode: string;
  fromUsername: string;
  /** Removes the invitation, after a dismissal or a successful join. */
  onDismiss: () => void;
}

/**
 * One received room invitation, with Join and Dismiss.
 *
 * Join is the ordinary join request and enters the room the same way Join Room does; the
 * invitation only supplies the room. When the server turns the join down, the reason
 * stays on the card and Dismiss clears it.
 */
export function RoomInvitation({ roomId, roomCode, fromUsername, onDismiss }: RoomInvitationProps) {
  const { t } = useTranslation();
  const id = useId();
  const { status, failure, join } = useJoinInvite();
  const joining = status === 'JOINING';

  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className={styles.card}
    >
      <div className={styles.top}>
        <span aria-hidden="true" className={styles.icon}>
          <Icon name="userAdd" />
        </span>
        <div className={styles.copy}>
          <h2 id={`${id}-title`} className={styles.title}>
            {t('room.invites.title', { username: fromUsername })}
          </h2>
          <p id={`${id}-body`} className={styles.body}>
            {t('room.invites.body')} <span className={styles.code}>{roomCode}</span>
          </p>
        </div>
      </div>
      {failure && (
        <p role="alert" className={styles.error}>
          {t(failure)}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          icon="login"
          sizeClassName={styles.join}
          onClick={() => {
            if (!joining) void join(roomId).then((joined) => joined && onDismiss());
          }}
          aria-disabled={joining || undefined}
          aria-busy={joining || undefined}
          className={styles.joinPlacement}
        >
          {t(joining ? 'room.invites.joining' : 'room.invites.join')}
        </Button>
        <button type="button" onClick={onDismiss} disabled={joining} className={styles.dismiss}>
          {t('room.invites.dismiss')}
        </button>
      </div>
    </section>
  );
}
