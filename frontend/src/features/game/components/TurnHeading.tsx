import { Trans, useTranslation } from 'react-i18next';

import { useSecondsUntil } from '@shared/hooks';
import type { Game } from '@shared/types';
import { Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import { isGameOver } from '../model/gameView';
import * as styles from './TurnHeading.styles';

/**
 * RED TEAM'S TURN — whose turn it is, from the server's `current_turn`. Once the match is
 * over it names the winner instead, and while the game waits for players it says so. On the desktop board only the team's name takes the
 * team's color; phones and tablets color the whole line.
 */
export function TurnHeading({ game, className }: { game: Game; className?: string }) {
  const { t } = useTranslation();
  const over = isGameOver(game);
  const team = over && game.winner ? game.winner : game.current_turn.team;

  return (
    <h1 aria-live="polite" className={cn(styles.heading, styles.compactTone[team], className)}>
      {over && game.winner ? (
        <span className={styles.wideTone[team]}>
          {t('game.results.wins', { team: t(`game.team.${team}`) })}
        </span>
      ) : game.current_turn.phase === 'PAUSED_FOR_PLAYERS' ? (
        t('game.turn.paused')
      ) : (
        <Trans
          i18nKey="game.turn.title"
          values={{ team: t(`game.team.${team}`) }}
          components={{ team: <span className={styles.wideTone[team]} /> }}
        />
      )}
    </h1>
  );
}

/** The last seconds of a turn, drawn in the warning tone. */
const URGENT_SECONDS = 10;

/**
 * 1:05 — time left in the active turn, from the server's `current_turn.deadline_at` and the
 * server clock offset. Renders nothing in a room without a turn limit, while the game is
 * paused and once it is over. The server ends the turn when the time runs out.
 */
export function TurnTimer({
  game,
  clockOffsetMs,
  className,
}: {
  game: Game;
  clockOffsetMs: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const seconds = useSecondsUntil(game.current_turn.deadline_at, clockOffsetMs);
  if (seconds === null || isGameOver(game)) return null;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <p
      role="timer"
      aria-label={t('game.turn.timeLeft')}
      className={cn(styles.timer, seconds <= URGENT_SECONDS && styles.timerUrgent, className)}
    >
      <Icon name="timer" />
      {time}
    </p>
  );
}
