import { useEffect, useId, useRef } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import headerArtwork from '@assets/room/join-room-header.svg';
import { Button, Dialog, Icon, LoadingDots } from '@shared/ui';
import { cn } from '@shared/utils';

import { useReturnToRoom } from '../hooks/useEnterRoom';
import { ROOM_CODE_LENGTH, useJoinRoom } from '../hooks/useJoinRoom';
import { canJoin } from '../model/capacity';
import type { JoinAvailability } from '../model/capacity';
import { EntryAlert } from './EntryAlert';
import * as shared from './RoomEntryDialog.styles';
import * as styles from './JoinRoomDialog.styles';

const JOINED = {
  tone: 'success',
  title: 'room.join.joinedTitle',
  body: 'room.join.joinedBody',
} as const;

const BADGE: Record<JoinAvailability, string> = {
  JOINABLE: 'room.join.status.waiting',
  IN_PROGRESS: 'room.join.status.inGame',
  FULL: 'room.join.status.full',
  NOT_JOINABLE: 'room.join.status.closed',
};

/**
 * Join Room, opened over Room Discovery.
 *
 * Rooms are found by their six-character code only. Once the code is complete the room is
 * looked up and previewed with its occupancy and status, and Join is offered while the room
 * has a free seat and takes players: a waiting room, or one counting down or playing, which
 * the player joins as a spectator. The server has the last word: if the room filled up or
 * closed to new players since the preview, the answer is shown here and the preview
 * refreshed, and the dialog stays open. The room opens only after the server has confirmed the join.
 */
export function JoinRoomDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { code, changeCode, preview, availability, status, failure, submit } = useJoinRoom();
  const returnToRoom = useReturnToRoom();
  const busy = status === 'JOINING' || status === 'JOINED';
  const fieldError = failure?.kind === 'field' ? failure.message : null;
  const blocked = availability !== null && !canJoin(availability);

  // The shell focuses the close button first; the code field is where the user starts.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const submitLabel =
    status === 'JOINED'
      ? t('room.join.opening')
      : status === 'JOINING'
        ? t('room.join.joining')
        : availability === 'FULL'
          ? t('room.join.full')
          : availability === 'NOT_JOINABLE'
            ? t('room.join.notJoinable')
            : availability === 'IN_PROGRESS'
              ? t('room.join.spectate')
              : t('room.join.submit');

  const inputStatus = fieldError ? 'error' : status === 'JOINED' ? 'success' : 'default';

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-subtitle`}
      closeLabel={t('common.close')}
      onClose={onClose}
      closable={!busy}
      className={shared.dialog}
    >
      <img src={headerArtwork} alt="" className={styles.header} />

      <h2 id={`${id}-title`} className={cn(shared.title, 'mt-[8px]')}>
        {t('room.join.title')}
      </h2>
      <p id={`${id}-subtitle`} className={cn(shared.subtitle, 'text-text-faint')}>
        {t('room.join.subtitle')}
      </p>

      <form noValidate onSubmit={onSubmit} className={styles.form}>
        <label htmlFor={`${id}-code`} className={styles.label}>
          {t('room.join.codeLabel')}
        </label>
        <div className={styles.control}>
          <Icon name="key" className={styles.keyIcon} />
          <input
            ref={inputRef}
            id={`${id}-code`}
            name="room_code"
            value={code}
            onChange={(event) => changeCode(event.target.value)}
            readOnly={busy}
            placeholder={t('room.join.codePlaceholder')}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={ROOM_CODE_LENGTH}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${id}-message` : undefined}
            className={cn(styles.inputBase, styles.inputStatus[inputStatus])}
          />
        </div>
        {fieldError && (
          <p id={`${id}-message`} role="alert" className={cn(shared.message, styles.fieldMessage)}>
            <span className={shared.messageBadge}>
              <Icon name="warning" />
            </span>
            {t(fieldError)}
          </p>
        )}

        <div className={styles.slot} aria-live="polite">
          {status === 'FINDING' && (
            <div className={styles.finding}>
              <LoadingDots label={t('room.join.finding')} />
              <p aria-hidden="true" className={styles.findingText}>
                {t('room.join.finding')}
              </p>
            </div>
          )}
          {status === 'JOINED' && <EntryAlert alert={JOINED} />}
          {failure && failure.kind !== 'field' && (
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
          {preview && availability && status !== 'FINDING' && status !== 'JOINED' && (
            <div className={cn(styles.preview, failure?.kind === 'alert' && 'mt-[12px]')}>
              <span aria-hidden="true" className={styles.previewPointer} />
              <div className={styles.previewHead}>
                <span aria-hidden="true" className={styles.previewTile}>
                  <Icon name="game" />
                </span>
                <div className="flex min-w-0 flex-col gap-[4px]">
                  <p className={styles.previewCode}>{preview.room_code}</p>
                  <p className={styles.previewCaption}>{t('room.join.previewCaption')}</p>
                </div>
              </div>
              <div className={styles.previewFoot}>
                <span className={styles.previewPlayers}>
                  <Icon name="profile" />
                  {t('room.join.players', {
                    count: preview.player_count,
                    max: preview.max_players,
                  })}
                </span>
                <span className={cn(styles.badgeBase, styles.badgeTone[availability])}>
                  {t(BADGE[availability])}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={cn(shared.actions, 'mt-[20px]')}>
          <Button
            type="submit"
            loading={busy}
            disabled={blocked && !busy}
            trailingIcon={blocked && !busy ? 'block' : 'login'}
            sizeClassName={cn(shared.submit, 'gap-2')}
            block
          >
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
