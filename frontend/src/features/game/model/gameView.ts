/**
 * What the Game Board shows this player, derived from the authoritative game state and the
 * player's own seat. Nothing here decides a rule: which cards a player sees in color is the
 * server's projection, who may act is the server's turn, and the winner is the server's.
 * These functions only choose which designed state to draw, and every action they allow is
 * validated again by the server.
 */

import type { Card, Game, PlayingRole, Team } from '@shared/types';

/** The player's seat for this match. Both are `null` for a member without one. */
export interface Seat {
  team: Team | null;
  role: PlayingRole | null;
}

/**
 * The designed Game Board states:
 * - `CLUE`: the active Spymaster gives a clue.
 * - `CLUE_SENT`: the Spymaster whose clue the Operatives are playing.
 * - `WAITING_FOR_CLUE`: an active-team Operative while their Spymaster chooses a clue.
 * - `GUESSING`: an active-team Operative picking cards.
 * - `OPPONENT_TURN`: a player whose team is not playing.
 * - `UNSEATED`: a member who joined a paused match and has not taken its free seat.
 * - `PAUSED`: everyone, while the game waits for a team's missing player.
 * - `GAME_OVER`: the match has a result.
 */
export type GameStage =
  | 'CLUE'
  | 'CLUE_SENT'
  | 'WAITING_FOR_CLUE'
  | 'GUESSING'
  | 'OPPONENT_TURN'
  | 'UNSEATED'
  | 'PAUSED'
  | 'GAME_OVER';

export function isGameOver(game: Game): boolean {
  return (
    game.status !== 'IN_PROGRESS' || game.winner !== null || game.current_turn.phase === 'GAME_OVER'
  );
}

export function gameStage(game: Game, seat: Seat): GameStage {
  if (isGameOver(game)) return 'GAME_OVER';
  const { team, phase } = game.current_turn;
  if (phase === 'PAUSED_FOR_PLAYERS') return 'PAUSED';
  if (!seat.team || !seat.role) return 'UNSEATED';
  if (seat.team !== team) return 'OPPONENT_TURN';
  if (seat.role === 'SPYMASTER') return phase === 'WAITING_FOR_CLUE' ? 'CLUE' : 'CLUE_SENT';
  return phase === 'GUESSING' ? 'GUESSING' : 'WAITING_FOR_CLUE';
}

/** Whether this player may pick a card right now. The server checks it again. */
export function canGuess(game: Game, stage: GameStage): boolean {
  return stage === 'GUESSING' && (game.current_turn.guesses_remaining ?? 0) > 0;
}

/** Whether `card` is one this player may select right now. */
export function isPickable(card: Card, game: Game, stage: GameStage): boolean {
  return !card.revealed && canGuess(game, stage);
}

/**
 * The selected card while it can still be guessed: an unrevealed card on a board this
 * player may guess on. A selection the game has overtaken (the card was revealed, the turn
 * moved on) counts as none, so Confirm Guess cannot send it.
 */
export function guessableSelection(
  game: Game,
  stage: GameStage,
  selectedCard: number | null,
): Card | null {
  if (selectedCard === null) return null;
  const card = game.board.find((c) => c.card_id === selectedCard);
  return card && isPickable(card, game, stage) ? card : null;
}

/**
 * How strongly a card is drawn, matching the designed boards. A Spymaster's revealed cards
 * fall back to 40% so the cards still in play stand out, and they soften to 80% while
 * the Operatives play the clue; anyone else who cannot pick sees the board at 55%.
 */
export type CardEmphasis = 'full' | 'soft' | 'muted' | 'faded';

export function cardEmphasis(card: Card, stage: GameStage, role: PlayingRole | null): CardEmphasis {
  if (role === 'SPYMASTER') {
    if (card.revealed) return 'faded';
    return stage === 'CLUE' || stage === 'GAME_OVER' ? 'full' : 'soft';
  }
  return stage === 'GUESSING' || stage === 'GAME_OVER' ? 'full' : 'muted';
}

/** The other team. */
export function opponentOf(team: Team): Team {
  return team === 'RED' ? 'BLUE' : 'RED';
}
