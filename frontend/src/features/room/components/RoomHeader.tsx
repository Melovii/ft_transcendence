import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROOM_LANGUAGES, TURN_TIMER_OPTIONS } from '@shared/types';
import type { Room, RoomLanguage } from '@shared/types';
import { Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import type { RoomSetup } from '../hooks/useRoomSetup';
import { roomSettingsAccess, settingsCapacityOptions } from '../model/capacity';
import { isFull } from '../model/readyRoom';
import * as styles from './RoomHeader.styles';

const COPIED_MS = 1_800;

/** The shareable room code and a button that copies it for pasting into a message. */
export function RoomCode({ code, className }: { code: string; className?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'DONE' | 'FAILED' | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('DONE');
    } catch {
      setCopied('FAILED');
    }
  };

  return (
    <div className={cn(styles.code, className)}>
      <p className={styles.codeText}>
        <span className="sr-only">{t('room.ready.codeLabel')} </span>
        {code}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t('room.ready.copyCode')}
        className={cn(styles.copyButton, copied === 'DONE' && styles.copyDone)}
      >
        <Icon name={copied === 'DONE' ? 'check' : 'copy'} />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied && t(copied === 'DONE' ? 'room.ready.codeCopied' : 'room.ready.copyFailed')}
      </span>
    </div>
  );
}

/**
 * The turn timer and the room language. The Room Owner picks the turn timer from
 * `TURN_TIMER_OPTIONS` and the language of the board's words from `ROOM_LANGUAGES` while the
 * room waits, under the same rules as the room size; everyone else sees the values
 * read-only, and every member sees a change as soon as the server announces it. The room
 * language is a game setting: it never changes the interface language. Everyone is told who
 * may change the room's settings.
 */
export function RoomSettingsInfo({
  room,
  userId,
  setup,
  className,
}: {
  room: Room;
  userId: number;
  setup: RoomSetup;
  className?: string;
}) {
  const { t } = useTranslation();
  const timerId = useId();
  const languageId = useId();
  const hintId = useId();
  const languageHintId = useId();
  const language = roomLanguageName(room.language);
  const isHost = room.host_user_id === userId;
  const access = roomSettingsAccess(room, userId);
  const timerLabel = (seconds: number | null) =>
    seconds === null ? t('room.settings.noLimit') : t('room.settings.seconds', { count: seconds });

  const changeLanguage = (value: string) => {
    const next = ROOM_LANGUAGES.find((option) => option === value);
    if (setup.pending === null && next !== undefined && next !== room.language) {
      void setup.updateLanguage(next);
    }
  };

  const changeTimer = (value: string) => {
    const seconds = TURN_TIMER_OPTIONS.find((option) => String(option) === value);
    if (setup.pending === null && seconds !== undefined && seconds !== room.turn_timer_seconds) {
      void setup.updateTurnTimer(seconds);
    }
  };

  return (
    <div className={cn(styles.settings, className)}>
      <div className={styles.settingRow}>
        {access.editable ? (
          <span className={cn(styles.settingChip, styles.settingChipEditable)}>
            <Icon name="timer" />
            <label htmlFor={timerId} className={styles.settingLabel}>
              {t('room.settings.timer')}
            </label>
            <select
              id={timerId}
              value={String(room.turn_timer_seconds)}
              onChange={(event) => changeTimer(event.target.value)}
              disabled={setup.pending !== null}
              aria-busy={setup.pending === 'timer'}
              className={styles.settingSelect}
            >
              {TURN_TIMER_OPTIONS.map((option) => (
                <option key={String(option)} value={String(option)}>
                  {timerLabel(option)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" className={styles.settingSelectIcon} />
          </span>
        ) : (
          <span className={styles.settingChip} aria-describedby={hintId}>
            <Icon name="timer" />
            <span className={styles.settingLabel}>{t('room.settings.timer')}</span>
            {timerLabel(room.turn_timer_seconds)}
            <span id={hintId} className="sr-only">
              {t(
                access.reason === 'NOT_HOST'
                  ? 'room.ready.hints.timerHostOnly'
                  : 'room.ready.hints.locked',
              )}
            </span>
          </span>
        )}
        {access.editable ? (
          <span className={cn(styles.settingChip, styles.settingChipEditable)}>
            <Icon name="rules" />
            <label htmlFor={languageId} className={styles.settingLabel}>
              {t('room.settings.language')}
            </label>
            <select
              id={languageId}
              value={room.language}
              onChange={(event) => changeLanguage(event.target.value)}
              disabled={setup.pending !== null}
              aria-busy={setup.pending === 'language'}
              className={styles.settingSelect}
            >
              {ROOM_LANGUAGES.map((option) => (
                <option key={option} value={option} lang={option}>
                  {roomLanguageName(option)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" className={styles.settingSelectIcon} />
          </span>
        ) : (
          <span className={styles.settingChip} aria-describedby={languageHintId}>
            <Icon name="rules" />
            <span className={styles.settingLabel}>{t('room.settings.language')}</span>
            <span lang={room.language}>{language}</span>
            <span id={languageHintId} className="sr-only">
              {t(
                access.reason === 'NOT_HOST'
                  ? 'room.ready.hints.languageHostOnly'
                  : 'room.ready.hints.locked',
              )}
            </span>
          </span>
        )}
      </div>
      <p className={styles.ownerNote}>
        <Icon name={isHost ? 'host' : 'lock'} />
        {t(isHost ? 'room.settings.ownerYou' : 'room.settings.ownerOnly')}
      </p>
    </div>
  );
}

/**
 * Each room language under its own name, the same in every interface language, so a
 * player always recognizes the language the board's words come in.
 */
const ROOM_LANGUAGE_NAMES: Record<RoomLanguage, string> = {
  en: 'English',
  tr: 'Türkçe',
  fr: 'Français',
};

/** A room language's own name, or the server's code for one this client does not know. */
function roomLanguageName(code: string): string {
  return ROOM_LANGUAGE_NAMES[code as RoomLanguage] ?? code;
}

/**
 * MAX PLAYERS and the player count. Only the host changes the size, only while the room
 * waits, and never below the players already in it; the server applies the change for
 * everyone with `room.settings.updated`. Everyone else sees the stepper locked.
 */
export function RoomCapacity({
  room,
  userId,
  setup,
  className,
}: {
  room: Room;
  userId: number;
  setup: RoomSetup;
  className?: string;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const hintId = useId();
  const access = roomSettingsAccess(room, userId);
  const options = settingsCapacityOptions(room);
  const min = options[0] ?? room.max_players;
  const max = options[options.length - 1] ?? room.max_players;
  const busy = setup.pending !== null;
  const full = isFull(room);

  const change = (value: number) => {
    if (!busy && value !== room.max_players) void setup.updateMaxPlayers(value);
  };

  return (
    <div className={cn(styles.capacity, className)}>
      <span id={labelId} className={styles.capacityLabel}>
        {t('room.ready.maxPlayers')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={access.editable ? undefined : hintId}
        aria-busy={setup.pending === 'capacity'}
        className={cn(styles.stepper, !access.editable && styles.stepperLocked)}
      >
        <button
          type="button"
          onClick={() => change(room.max_players - 1)}
          disabled={!access.editable || room.max_players <= min}
          aria-label={t('room.create.fewerPlayers')}
          className={styles.stepperButton}
        >
          <Icon name="remove" />
        </button>
        <output
          aria-label={t('room.ready.maxPlayers')}
          className={cn(styles.stepperValue, !access.editable && styles.stepperValueLocked)}
        >
          {room.max_players}
        </output>
        <button
          type="button"
          onClick={() => change(room.max_players + 1)}
          disabled={!access.editable || room.max_players >= max}
          aria-label={t('room.create.morePlayers')}
          className={styles.stepperButton}
        >
          <Icon name="add" />
        </button>
      </div>
      {!access.editable && (
        <span id={hintId} className="sr-only">
          {t(
            access.reason === 'NOT_HOST' ? 'room.ready.hints.hostOnly' : 'room.ready.hints.locked',
          )}
        </span>
      )}
      <span className={cn(styles.countBadge, styles.countTone[full ? 'full' : 'open'])}>
        {full
          ? t('room.ready.roomFull')
          : t('room.ready.playerCount', { count: room.player_count, max: room.max_players })}
      </span>
    </div>
  );
}
