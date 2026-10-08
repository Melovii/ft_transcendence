import { useId } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import mascotArtwork from '@assets/room/create-room-mascot.svg';
import { Button, Dialog, Icon } from '@shared/ui';
import type { IconName } from '@shared/ui';
import { ROOM_CAPACITY } from '@shared/types';
import { cn } from '@shared/utils';

import { useCreateRoom } from '../hooks/useCreateRoom';
import { useReturnToRoom } from '../hooks/useEnterRoom';
import { EntryAlert } from './EntryAlert';
import * as shared from './RoomEntryDialog.styles';
import * as styles from './CreateRoomDialog.styles';

const BENEFITS: { key: string; icon: IconName; tile: string }[] = [
  { key: 'newRoom', icon: 'rules', tile: styles.benefitTile.primary },
  { key: 'inviteFriends', icon: 'players', tile: styles.benefitTile.success },
  { key: 'chooseRole', icon: 'game', tile: styles.benefitTile.coral },
];

const CREATED = {
  tone: 'success',
  title: 'room.create.createdTitle',
  body: 'room.create.createdBody',
} as const;

/**
 * Create Room, opened over Room Discovery.
 *
 * The host picks the room's capacity; the stepper only offers what the contract accepts.
 * The room exists once the server has created it: the dialog then confirms and the room
 * opens. While the request runs the dialog cannot be dismissed, because its result still
 * has to be shown. A failure keeps the dialog open with the chosen capacity and offers to
 * try again; a user who already has a room is offered the way back to it.
 */
export function CreateRoomDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const { maxPlayers, changeMaxPlayers, status, failure, submit, enterCreated } = useCreateRoom();
  const returnToRoom = useReturnToRoom();
  const busy = status === 'CREATING' || status === 'CREATED';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'CREATED') enterCreated();
    else void submit();
  };

  const submitLabel = {
    IDLE: t('room.create.submit'),
    CREATING: t('room.create.creating'),
    CREATED: t('room.create.goToRoom'),
    FAILED: t('room.create.retry'),
  }[status];

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-subtitle`}
      closeLabel={t('common.close')}
      onClose={onClose}
      closable={!busy}
      className={shared.dialog}
    >
      <img src={mascotArtwork} alt="" className={styles.mascot} />

      <h2 id={`${id}-title`} className={shared.title}>
        {t('room.create.title')}
      </h2>
      <p id={`${id}-subtitle`} className={shared.subtitle}>
        {t('room.create.subtitle')}
      </p>

      <ul className={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <li key={benefit.key} className={styles.benefit}>
            <span className={cn(styles.benefitTileBase, benefit.tile)}>
              <Icon name={benefit.icon} />
            </span>
            {t(`room.create.benefits.${benefit.key}`)}
          </li>
        ))}
      </ul>

      <form noValidate onSubmit={onSubmit} className={styles.form}>
        {status === 'CREATED' && <EntryAlert alert={CREATED} />}
        {failure && (
          <EntryAlert
            alert={failure.alert}
            action={
              failure.kind === 'active-room' && (
                <button
                  type="button"
                  onClick={() => returnToRoom(failure.activeRoomId)}
                  className={shared.alertAction}
                >
                  {t('room.feedback.returnToRoom')}
                </button>
              )
            }
          />
        )}

        <div className={styles.capacity}>
          <span id={`${id}-capacity`} className={styles.capacityLabel}>
            {t('room.create.maxPlayers')}
            <span className={styles.capacityHint}>
              {t('room.create.maxPlayersHint', {
                min: ROOM_CAPACITY.min,
                max: ROOM_CAPACITY.max,
              })}
            </span>
          </span>

          <div role="group" aria-labelledby={`${id}-capacity`} className={styles.stepper}>
            <button
              type="button"
              onClick={() => changeMaxPlayers(maxPlayers - 1)}
              disabled={busy || maxPlayers <= ROOM_CAPACITY.min}
              aria-label={t('room.create.fewerPlayers')}
              className={styles.stepperButton}
            >
              <Icon name="remove" />
            </button>
            <output aria-live="polite" className={styles.stepperValue}>
              {maxPlayers}
            </output>
            <button
              type="button"
              onClick={() => changeMaxPlayers(maxPlayers + 1)}
              disabled={busy || maxPlayers >= ROOM_CAPACITY.max}
              aria-label={t('room.create.morePlayers')}
              className={styles.stepperButton}
            >
              <Icon name="add" />
            </button>
          </div>
        </div>

        <div className={shared.actions}>
          <Button type="submit" loading={status === 'CREATING'} sizeClassName={shared.submit} block>
            {status !== 'CREATED' && (
              <span aria-hidden="true" className={cn(shared.submitIcon, 'text-primary-sky')}>
                <Icon name="add" />
              </span>
            )}
            {submitLabel}
          </Button>
          <Button
            theme="outline"
            variant="danger"
            onClick={onClose}
            disabled={busy}
            sizeClassName={shared.cancel}
            block
          >
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
