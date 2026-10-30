import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Clue } from '@shared/types';
import { Button, Icon, LoadingDots } from '@shared/ui';
import { cn } from '@shared/utils';

import type { GameActions } from '../hooks/useGameActions';
import { CLUE_NUMBER, isBoardWord, isOneWordClue } from '../model/clue';
import * as styles from './CluePanel.styles';

/** The server's answer to a command it turned down, shown next to the control that sent it. */
export function ActionFeedback({
  actions,
  action,
  className,
}: {
  actions: GameActions;
  action: 'clue' | 'guess' | 'pass';
  className?: string;
}) {
  const { t } = useTranslation();
  if (actions.feedback?.action !== action) return null;
  return (
    <p role="alert" className={cn(styles.feedback, className)}>
      {t(actions.feedback.message)}
    </p>
  );
}

/** The number stepper: how many cards the clue links. */
function ClueNumber({
  value,
  onChange,
  disabled,
  labelledBy,
  tone = 'default',
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled: boolean;
  labelledBy: string;
  tone?: 'default' | 'sent';
}) {
  const { t } = useTranslation();
  const set = (next: number) =>
    onChange?.(Math.min(CLUE_NUMBER.max, Math.max(CLUE_NUMBER.min, next)));

  return (
    <div role="group" aria-labelledby={labelledBy} className={styles.stepper[tone]}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= CLUE_NUMBER.min}
        aria-label={t('game.clue.decrease')}
        className={styles.stepperButton}
      >
        <Icon name="remove" />
      </button>
      <output aria-live="polite" className={styles.stepperValue}>
        {value}
      </output>
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= CLUE_NUMBER.max}
        aria-label={t('game.clue.increase')}
        className={styles.stepperButton}
      >
        <Icon name="add" />
      </button>
    </div>
  );
}

/**
 * GIVE A CLUE: the active Spymaster's one word and number. Give Clue stays disabled until
 * the clue is one word that is not on the board; the server checks the clue again, without
 * changing it into another word. While the clue is on its way the form keeps its values and
 * cannot be sent twice, and the board moves on only when the server announces the clue.
 */
export function ClueForm({
  actions,
  boardWords,
  className,
}: {
  actions: GameActions;
  /** Every word on the board, revealed or not; none of them may be the clue. */
  boardWords: readonly string[];
  className?: string;
}) {
  const { t } = useTranslation();
  const ids = { word: useId(), number: useId(), hint: useId(), error: useId() };
  const [word, setWord] = useState('');
  const [number, setNumber] = useState<number>(CLUE_NUMBER.min);
  const sending = actions.pending === 'clue';
  const trimmed = word.trim();
  const oneWord = isOneWordClue(trimmed);
  const onBoard = oneWord && isBoardWord(trimmed, boardWords);
  const valid = oneWord && !onBoard;
  const showRule = trimmed.length > 0 && !valid;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || sending) return;
    void actions.submitClue(trimmed, number);
  };

  return (
    <form onSubmit={submit} noValidate className={cn(styles.form, className)}>
      <div className={styles.formGrid}>
        <p id={ids.hint} className={styles.formHint}>
          {t('game.instruction.CLUE')}
        </p>
        <div className={styles.formLabels}>
          <label htmlFor={ids.word} className={styles.label}>
            {t('game.clue.label')}
          </label>
          <span aria-hidden="true" className={styles.formHeading}>
            {t('game.clue.heading')}
          </span>
        </div>
        <span id={ids.number} className={cn(styles.label, styles.numberLabel)}>
          {t('game.clue.number')}
        </span>
        <input
          id={ids.word}
          value={word}
          onChange={(event) => setWord(event.target.value)}
          readOnly={sending}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('game.clue.placeholder')}
          aria-invalid={showRule || undefined}
          aria-describedby={cn(ids.hint, showRule && ids.error) || undefined}
          className={styles.clueInput}
        />
        <ClueNumber
          value={number}
          onChange={setNumber}
          disabled={sending}
          labelledBy={ids.number}
        />
        <Button
          type="submit"
          sizeClassName={styles.submit}
          disabled={!valid}
          aria-busy={sending || undefined}
          className={styles.submitPlacement}
        >
          {t(sending ? 'game.clue.sending' : 'game.clue.submit')}
          <span aria-hidden="true" className={styles.submitIcon}>
            <Icon name="send" />
          </span>
        </Button>
      </div>
      {showRule && (
        <p id={ids.error} className={styles.rule}>
          {t(onBoard ? 'game.errors.clueOnBoard' : 'game.clue.rule')}
        </p>
      )}
      <ActionFeedback actions={actions} action="clue" className={styles.formFeedback} />
    </form>
  );
}

/** The clue as the board shows it: `CLUE: SPACE · 3`. */
export function ClueText({ clue }: { clue: Clue }) {
  const { t } = useTranslation();
  return <>{t('game.clue.value', { word: clue.word.toUpperCase(), number: clue.number })}</>;
}

/**
 * CLUE SENT: the Spymaster's own clue while their Operatives play it, with the guesses
 * left. The desktop keeps the form's shape, filled and locked; phones and tablets show
 * the clue as text.
 */
export function ClueSentPanel({
  clue,
  guessesRemaining,
  className,
}: {
  clue: Clue;
  guessesRemaining: number | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const numberLabel = useId();
  const guesses = t('game.clue.guesses', { count: guessesRemaining ?? 0 });

  return (
    <section aria-label={t('game.clue.sent')} className={cn(styles.sent, className)}>
      <div className={styles.sentWide}>
        <div className={styles.sentLabels}>
          <span className={styles.sentLabel}>{t('game.clue.sentLabel')}</span>
        </div>
        <span id={numberLabel} className={cn(styles.sentLabel, styles.numberLabel)}>
          {t('game.clue.sentNumber')}
        </span>
        <span className={styles.sentValue}>{clue.word.toUpperCase()}</span>
        <ClueNumber value={clue.number} disabled labelledBy={numberLabel} tone="sent" />
        <div className={styles.sentStatus}>
          <span className={styles.sentTitle}>
            <Icon name="check" className={styles.sentCheck} />
            {t('game.clue.sent')}
          </span>
          <span className={styles.sentGuesses}>{guesses}</span>
        </div>
      </div>

      <div className={styles.sentCompact}>
        <p className={styles.formHint}>{t('game.instruction.CLUE_SENT')}</p>
        <p className={styles.compactTitle}>
          <ClueText clue={clue} />
        </p>
        <p className={styles.compactBody}>{guesses}</p>
      </div>
    </section>
  );
}

/**
 * The Operatives' panel and every waiting state: a title, a line under it, the waiting
 * dots while someone else is choosing, and the Pass button where the design has one.
 */
export function StatusPanel({
  title,
  body,
  waiting = false,
  tone = 'muted',
  action,
  actionClassName,
  actionInline = false,
  className,
}: {
  title: ReactNode;
  body: ReactNode;
  waiting?: boolean;
  /** `strong` for the active clue, `muted` for a waiting state. */
  tone?: 'strong' | 'muted';
  action?: ReactNode;
  /** Positions an action that is not the designed Pass button. */
  actionClassName?: string;
  /** `true` puts the action beside the text instead of in the corner, for wider actions. */
  actionInline?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-live="polite"
      className={cn(actionInline ? styles.statusInline : styles.status, className)}
    >
      {waiting && (
        <LoadingDots label={t('game.status.waitingLabel')} className={styles.statusDots} />
      )}
      <div className={actionInline ? styles.statusTextInline : styles.statusText}>
        <p className={cn(styles.statusTitle, styles.statusTones[tone])}>{title}</p>
        <p className={styles.statusBody}>{body}</p>
      </div>
      {action && (
        <div
          className={cn(
            actionInline ? styles.statusActionInline : styles.statusAction,
            actionClassName,
          )}
        >
          {action}
        </div>
      )}
    </section>
  );
}

/**
 * CONFIRM GUESS: sends the card the Operative selected as the team's guess. It is live only
 * while a card that can still be guessed is selected; the card turns over when the server
 * reveals it, for every player at once.
 */
export function ConfirmGuessButton({
  actions,
  selectedWord,
}: {
  actions: GameActions;
  /** The selected card's word, or `null` when nothing guessable is selected. */
  selectedWord: string | null;
}) {
  const { t } = useTranslation();
  const confirming = actions.pending === 'guess';
  const enabled = selectedWord !== null && actions.pending === null;
  return (
    <Button
      sizeClassName={styles.confirm}
      className={styles.confirmPlacement}
      onClick={actions.confirmGuess}
      disabled={!enabled && !confirming}
      aria-disabled={confirming || undefined}
      aria-busy={confirming || undefined}
      aria-label={selectedWord ? t('game.guess.confirmLabel', { word: selectedWord }) : undefined}
    >
      {t(confirming ? 'game.guess.confirming' : 'game.guess.confirm')}
    </Button>
  );
}

/**
 * PASS: ends the team's guessing. It is live only for an active-team Operative with
 * guesses left, and elsewhere it stays in place, muted and disabled, as designed.
 */
export function PassButton({ actions, enabled }: { actions: GameActions; enabled: boolean }) {
  const { t } = useTranslation();
  const passing = actions.pending === 'pass';
  return (
    <div className={styles.passWrap}>
      <button
        type="button"
        onClick={actions.passTurn}
        disabled={!enabled || actions.pending !== null}
        aria-busy={passing || undefined}
        className={cn(styles.pass, enabled ? styles.passLive : styles.passIdle)}
      >
        {t(passing ? 'game.pass.passing' : 'game.pass.action')}
      </button>
      <ActionFeedback actions={actions} action="pass" />
    </div>
  );
}
