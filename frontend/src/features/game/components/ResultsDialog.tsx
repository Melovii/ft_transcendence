import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import trophyArtwork from '@assets/game/results-trophy.svg';
import type { GameEndReason, Score, Team } from '@shared/types';
import { Button, Dialog } from '@shared/ui';
import { cn } from '@shared/utils';

import { opponentOf } from '../model/gameView';
import * as styles from './ResultsDialog.styles';

export interface MatchResult {
  winner: Team;
  reason: GameEndReason | null;
  score: Score;
}

/** What the player can do on a result, and how long they have to decide. */
export interface ResultDecision {
  /** Whole seconds left before the server removes undecided players; `null` if unknown. */
  secondsLeft: number | null;
  returning: boolean;
  returnFailed: boolean;
  leaving: boolean;
  onBackToLobby: () => void;
  onExit: () => void;
}

/** Why the match ended, in the words of the Results card. */
export function ResultReason({ result }: { result: MatchResult }) {
  const { t } = useTranslation();
  const winner = t(`game.team.${result.winner}`);
  const loser = t(`game.team.${opponentOf(result.winner)}`);
  switch (result.reason) {
    case 'ALL_TEAM_CARDS_REVEALED':
      return <>{t('game.results.reason.ALL_TEAM_CARDS_REVEALED', { team: winner })}</>;
    case 'ASSASSIN_REVEALED':
      return <>{t('game.results.reason.ASSASSIN_REVEALED', { team: loser })}</>;
    default:
      return null;
  }
}

/** `RED TEAM WINS!` */
export function WinnerHeadline({ winner }: { winner: Team }) {
  const { t } = useTranslation();
  return <>{t('game.results.wins', { team: t(`game.team.${winner}`) })}</>;
}

/**
 * How long is left to decide, and a failed Back to Lobby. Read on demand rather than
 * announced every second.
 */
export function DecisionNote({ decision }: { decision: ResultDecision }) {
  const { t } = useTranslation();
  return (
    <>
      {decision.secondsLeft !== null && (
        <p className={styles.deadline}>
          {t('game.results.deadline', { seconds: decision.secondsLeft })}
        </p>
      )}
      {decision.returnFailed && (
        <p role="alert" className={styles.error}>
          {t('game.results.returnFailed')}
        </p>
      )}
    </>
  );
}

/**
 * MATCH OVER. It opens over the board the moment the server announces the result, names
 * the winning team and why the match ended, and shows each team's revealed cards. Every
 * value is the server's: nothing here decides a winner.
 *
 * Each player decides on their own, before the server's deadline: Back to Lobby keeps them
 * in the room for the next match, Exit leaves it. Whoever has not decided by the deadline
 * is taken out of the room. View Final Board closes the card and leaves the board on
 * screen.
 */
export function ResultsDialog({
  result,
  decision,
  onViewBoard,
}: {
  result: MatchResult;
  decision: ResultDecision;
  onViewBoard: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const reasonId = useId();
  const busy = decision.returning || decision.leaving;

  return (
    <Dialog
      role="alertdialog"
      labelledBy={titleId}
      describedBy={reasonId}
      closeLabel={t('game.results.viewBoard')}
      onClose={onViewBoard}
      closable={!busy}
      showCloseButton={false}
      className={styles.card}
    >
      <p className={styles.badge}>{t('game.results.badge')}</p>
      <img src={trophyArtwork} alt="" className={styles.trophy} />
      <h2 id={titleId} className={cn(styles.headline, styles.headlineTone[result.winner])}>
        <WinnerHeadline winner={result.winner} />
      </h2>
      <p id={reasonId} className={styles.reason}>
        <ResultReason result={result} />
      </p>
      <p className={styles.scores}>
        <span className="sr-only">
          {t('game.score.label', { red: result.score.red, blue: result.score.blue })}
        </span>
        {(['RED', 'BLUE'] as const).map((team, index) => (
          <span key={team} aria-hidden="true" className="contents">
            {index === 1 && <span className={styles.separator}>—</span>}
            <span className={cn(styles.chip, styles.chipTone[team])}>
              <span className={styles.chipLabel}>{t(`game.team.${team}`)}</span>
              <span className={styles.chipScore}>
                {team === 'RED' ? result.score.red : result.score.blue}
              </span>
            </span>
          </span>
        ))}
      </p>
      <DecisionNote decision={decision} />
      <div className={styles.actions}>
        <Button
          sizeClassName={styles.primary}
          onClick={() => !busy && decision.onBackToLobby()}
          aria-disabled={busy || undefined}
          aria-busy={decision.returning || undefined}
          className={styles.busy}
        >
          {t(decision.returning ? 'game.results.returning' : 'game.results.backToLobby')}
        </Button>
        <Button
          theme="outline"
          sizeClassName={styles.secondary}
          onClick={onViewBoard}
          disabled={busy}
          className="bg-surface"
        >
          {t('game.results.viewBoard')}
        </Button>
      </div>
      <Button
        theme="link"
        variant="secondary"
        sizeClassName={styles.exit}
        onClick={decision.onExit}
        disabled={busy}
        aria-busy={decision.leaving || undefined}
        className={styles.exitPlacement}
      >
        {t(decision.leaving ? 'room.leave.leaving' : 'game.results.exit')}
      </Button>
    </Dialog>
  );
}
