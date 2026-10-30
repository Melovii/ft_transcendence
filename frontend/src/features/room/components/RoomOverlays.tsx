import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, Dialog } from '@shared/ui';

import type { KickMember } from '../hooks/useKickMember';
import type { LeaveStatus } from '../hooks/useLeaveRoom';
import type { LeaveAction } from '../model/leave';
import * as styles from './RoomOverlays.styles';

/**
 * Leave Room (or Leave Game, once the match runs) confirmation. Stay, the safe choice, sits
 * on the left and the committing Leave on the right. While the leave request runs the
 * dialog cannot be dismissed, so its result is always shown.
 *
 * Leave Game says what leaving costs before the request is sent: a leave penalty on the
 * player's profile, heavier for a Spymaster, and a room that may close if nobody takes the
 * seat. The penalty's size is the server's to set, so no number is shown.
 */
export function LeaveRoomDialog({
  action,
  status,
  failed,
  onConfirm,
  onCancel,
}: {
  action: LeaveAction;
  status: LeaveStatus;
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const kind = action.kind.startsWith('LEAVE_GAME') ? 'game' : 'room';
  const body =
    action.kind === 'LEAVE_GAME_SPYMASTER'
      ? 'room.leave.game.body.SPYMASTER'
      : action.kind === 'LEAVE_GAME_OPERATIVE'
        ? 'room.leave.game.body.OPERATIVE'
        : 'room.leave.room.body';
  const leaving = status === 'LEAVING';

  return (
    <ConfirmDialog
      title={t(`room.leave.${kind}.title`)}
      body={t(body)}
      error={failed ? t('room.leave.failed') : null}
      cancelLabel={t('room.leave.stay')}
      confirmLabel={t(leaving ? 'room.leave.leaving' : `room.leave.${kind}.confirm`)}
      onCancel={onCancel}
      onConfirm={onConfirm}
      pending={leaving}
    />
  );
}

/**
 * The Room Owner's Kick confirmation. Cancel, the safe choice, sits on the left. The member
 * leaves when the server says so; until then the dialog shows the kick in progress, and a
 * refusal stays here. Removing a player from a running match says what it may cost the
 * match: their team may be left short, which pauses the game and can close the room.
 */
export function KickDialog({ kick, inMatch }: { kick: KickMember; inMatch: boolean }) {
  const { t } = useTranslation();
  const { target } = kick;
  if (!target) return null;
  const kicking = kick.status === 'KICKING';
  const playing = inMatch && target.role !== null;

  return (
    <ConfirmDialog
      title={t('room.kick.title', { username: target.username })}
      body={t(playing ? 'room.kick.bodyInGame' : 'room.kick.body', { username: target.username })}
      error={kick.failure && t(kick.failure)}
      cancelLabel={t('common.cancel')}
      confirmLabel={t(kicking ? 'room.kick.kicking' : 'room.kick.confirm')}
      onCancel={kick.close}
      onConfirm={() => void kick.confirm()}
      pending={kicking}
    />
  );
}

/**
 * GAME STARTING over the room while the server counts down. The number is the server's
 * `seconds_remaining`, so every player sees the same count, and nothing here starts the
 * game: the room moves on when the server announces `game.started`. Screen readers hear
 * the start once, not every tick.
 */
export function CountdownOverlay({ seconds }: { seconds: number | null }) {
  const { t } = useTranslation();
  const titleId = useId();
  const hintId = useId();

  return (
    <Dialog
      role="alertdialog"
      labelledBy={titleId}
      describedBy={hintId}
      closeLabel={t('common.close')}
      onClose={() => {}}
      closable={false}
      showCloseButton={false}
      className={styles.countdown}
    >
      <h2 id={titleId} className={styles.countdownEyebrow}>
        {t('room.countdown.title')}
      </h2>
      <div aria-hidden="true" className={styles.countdownRing}>
        {seconds !== null && (
          <span key={seconds} className={styles.countdownNumber}>
            {seconds}
          </span>
        )}
      </div>
      <p id={hintId} className={styles.countdownHint}>
        {t('room.countdown.hint')}
      </p>
    </Dialog>
  );
}
