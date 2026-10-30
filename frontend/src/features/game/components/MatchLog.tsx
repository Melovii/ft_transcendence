import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HistoryEntry } from '@shared/types';
import { Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import * as styles from './MatchLog.styles';

type Translate = ReturnType<typeof useTranslation>['t'];

/** A player's current name while they are still in the room, from the room's members. */
export type CurrentName = (userId: number) => string | undefined;

/**
 * One entry as a sentence, from the public facts the server recorded. A player still in
 * the room is named as they are called now; one who left keeps the recorded name.
 */
function describeEntry(entry: HistoryEntry, t: Translate, currentName: CurrentName): string {
  const team = (value: 'RED' | 'BLUE') => t(`game.team.${value}`);
  const name = (actor: { user_id: number; username: string }) =>
    currentName(actor.user_id) ?? actor.username;
  switch (entry.type) {
    case 'GAME_STARTED':
      return t('game.log.started', { team: team(entry.team) });
    case 'CLUE_GIVEN':
      return t('game.log.clue', {
        team: team(entry.team),
        username: name(entry),
        word: entry.clue.word.toUpperCase(),
        number: entry.clue.number,
      });
    case 'CARD_REVEALED':
      return t('game.log.revealed', {
        username: name(entry),
        word: entry.word,
        affiliation: t(`game.log.color.${entry.color}`),
      });
    case 'TURN_PASSED':
      return t('game.log.passed', { username: name(entry), team: team(entry.team) });
    case 'TURN_CHANGED':
      return entry.reason === 'TURN_TIMER_EXPIRED'
        ? t('game.log.timeUp', { previous: team(entry.previous_team), team: team(entry.team) })
        : t('game.log.turn', { team: team(entry.team) });
    case 'GAME_PAUSED':
      return t('game.log.paused', { username: name(entry), team: team(entry.team) });
    case 'GAME_RESUMED':
      return t('game.log.resumed', { team: team(entry.team) });
    case 'GAME_ENDED':
      if (!entry.team) return t('game.log.cancelled');
      return t(entry.reason === 'ASSASSIN_REVEALED' ? 'game.log.wonAssassin' : 'game.log.won', {
        team: team(entry.team),
      });
  }
}

/** The color an entry is marked with: its card's color, or the team it is about. */
function toneOf(entry: HistoryEntry): keyof typeof styles.dotTone {
  if (entry.type === 'CARD_REVEALED') {
    return entry.color === 'RED' || entry.color === 'BLUE' ? entry.color : 'NEUTRAL';
  }
  return entry.team ?? 'NEUTRAL';
}

/**
 * MATCH HISTORY: what has happened in this match, from the action log the server keeps
 * with the game. Every player sees the same entries, and a reconnect restores them from
 * the snapshot. The panel starts closed under the board with the newest action on one
 * line, so it never covers the cards; opening it lists every action, newest first.
 */
export function MatchLog({
  history,
  currentName,
  className,
}: {
  history: HistoryEntry[];
  currentName: CurrentName;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const latest = history.at(-1);
  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <section aria-label={t('game.log.title')} className={cn(styles.log, className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={styles.toggle}
      >
        <Icon name="history" className={styles.toggleIcon} />
        {t('game.log.title')}
        <span className={styles.count}>{history.length}</span>
        <Icon name="chevronDown" className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>
      {!open && (
        <p aria-live="polite" className={styles.latest}>
          {latest ? describeEntry(latest, t, currentName) : t('game.log.empty')}
        </p>
      )}
      {open && (
        <ol id={listId} className={styles.list}>
          {history.length === 0 && <li className={styles.empty}>{t('game.log.empty')}</li>}
          {[...history].reverse().map((entry) => (
            <li key={entry.seq} className={styles.entry}>
              <span aria-hidden="true" className={cn(styles.dot, styles.dotTone[toneOf(entry)])} />
              <span>{describeEntry(entry, t, currentName)}</span>
              <time dateTime={entry.at} className={styles.time}>
                {time.format(new Date(entry.at))}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
