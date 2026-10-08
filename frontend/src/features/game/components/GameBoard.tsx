import { useTranslation } from 'react-i18next';

import type { Card, Game, RoomRole } from '@shared/types';
import { WordCard } from '@shared/ui';
import { cn } from '@shared/utils';

import type { GameActions } from '../hooks/useGameActions';
import { cardEmphasis, isPickable } from '../model/gameView';
import type { GameStage } from '../model/gameView';
import * as styles from './GameBoard.styles';

/**
 * The 5×5 word board. Each card shows exactly what the server sent this player: a
 * Spymaster's board carries every affiliation, an Operative's carries only the revealed
 * ones, so an Operative's hidden cards have no affiliation to draw. Only an Operative
 * whose team is guessing gets pickable cards; everyone else sees the same board as plain
 * tiles. A pick goes to the server, and the card turns over when the server reveals it.
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
  role: RoomRole | null;
  actions: GameActions;
  className?: string;
}) {
  const { t } = useTranslation();
  const picking = actions.pending !== null;

  const labelFor = (card: Card, pickable: boolean): string => {
    if (!card.color) return pickable ? t('game.card.pick', { word: card.word }) : card.word;
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
              selected={actions.pickedCard === card.card_id}
              onSelect={pickable ? () => actions.guessCard(card.card_id) : undefined}
              disabled={picking}
              label={labelFor(card, pickable)}
            />
          </li>
        );
      })}
    </ul>
  );
}
