import { useTranslation } from 'react-i18next';

import type { Card, Game, PlayingRole } from '@shared/types';
import { WordCard } from '@shared/ui';
import { cn } from '@shared/utils';

import type { GameActions } from '../hooks/useGameActions';
import { cardEmphasis, guessableSelection, isPickable } from '../model/gameView';
import type { GameStage } from '../model/gameView';
import * as styles from './GameBoard.styles';

/**
 * The 5×5 word board. Each card shows exactly what the server sent this player: a
 * Spymaster's board carries every affiliation, an Operative's carries only the revealed
 * ones, so an Operative's hidden cards have no affiliation to draw. Only an Operative
 * whose team is guessing gets selectable cards; everyone else sees the same board as plain
 * tiles. Selecting a card only marks it on this client — another click moves the mark — and
 * nothing turns over until Confirm Guess sends it and the server reveals it.
 */
export function GameBoard({
  game,
  stage,
  role,
  actions,
  className,
}: {
  game: Game;
  stage: GameStage;
  role: PlayingRole | null;
  actions: GameActions;
  className?: string;
}) {
  const { t } = useTranslation();
  const picking = actions.pending !== null;
  const selected = guessableSelection(game, stage, actions.selectedCard);

  const labelFor = (card: Card, pickable: boolean): string => {
    if (!card.color) {
      if (!pickable) return card.word;
      return selected?.card_id === card.card_id
        ? t('game.card.selected', { word: card.word })
        : t('game.card.pick', { word: card.word });
    }
    const affiliation = t(`game.card.affiliation.${card.color}`);
    return card.revealed
      ? t('game.card.revealed', { word: card.word, affiliation })
      : t('game.card.key', { word: card.word, affiliation });
  };

  return (
    <ul aria-label={t('game.board')} className={cn(styles.board, className)}>
      {game.board.map((card) => {
        const pickable = isPickable(card, game, stage);
        return (
          <li key={card.card_id} className={styles.slot}>
            <WordCard
              word={card.word}
              color={card.color}
              revealed={card.revealed}
              emphasis={cardEmphasis(card, stage, role)}
              selected={selected?.card_id === card.card_id}
              onSelect={pickable ? () => actions.selectCard(card.card_id) : undefined}
              disabled={picking}
              label={labelFor(card, pickable)}
            />
          </li>
        );
      })}
    </ul>
  );
}
