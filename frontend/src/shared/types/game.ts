/**
 * Authoritative game state, from Bruno `v2/game-rest-api/00 - Rooms/get-room-snapshot.yml`
 * and the `game.*` events of `v2/game-websocket`.
 *
 * The frontend never derives a winner. Only a terminal `game.ended` event or a snapshot of
 * the completed game is authoritative — `workspace.yml` · Game Rules.
 */

import type { Score, Team } from './common';
import type { PlayingRole } from './room';

export type GamePhase = 'WAITING_FOR_CLUE' | 'GUESSING' | 'PAUSED_FOR_PLAYERS' | 'GAME_OVER';
export type GameStatus = 'IN_PROGRESS' | 'GAME_FINISHED' | 'GAME_CANCELLED';
export type CardColor = 'RED' | 'BLUE' | 'NEUTRAL' | 'ASSASSIN';

/** Why a match ended. `INSUFFICIENT_PLAYERS` is a cancellation with no winner. */
export type GameEndReason =
  'ALL_TEAM_CARDS_REVEALED' | 'ASSASSIN_REVEALED' | 'INSUFFICIENT_PLAYERS';

/**
 * One board slot. `card_id` is a stable `1..25` slot identifier that carries zero
 * affiliation information — nothing may infer color from it (Card ID invariant).
 */
export interface Card {
  card_id: number;
  word: string;
  revealed: boolean;
  /**
   * `null` only for a card an Operative or a spectator is not allowed to see yet.
   * Spymasters always receive the true color. The projection is made server-side.
   */
  color: CardColor | null;
}

export interface Clue {
  /** Normalized: trimmed, Unicode lowercase, single word, 1..30 characters. */
  word: string;
  /** `N`, in `1..9`. A clue grants `N + 1` guesses. */
  number: number;
}

export interface CurrentTurn {
  team: Team;
  phase: GamePhase;
  /** `null` while waiting for a clue. */
  clue: Clue | null;
  /** `N + 1` at clue acceptance; `null` while waiting for a clue. */
  guesses_remaining: number | null;
  /**
   * Absolute turn-timer deadline, covering the clue and the guesses. `null` when the room
   * has no turn limit, while the game is paused and once it is over. The server ends the
   * turn when it passes (`TURN_TIMER_EXPIRED`); the client only draws it.
   */
  deadline_at: string | null;
}

/** One team's staffing while the game is paused for players. */
export interface TeamStaffing {
  /** Empty when the team is fully staffed. */
  missing_roles: PlayingRole[];
  /** Absolute shutdown deadline; `null` when the team is fully staffed. */
  deadline_at: string | null;
}

export interface Staffing {
  red: TeamStaffing;
  blue: TeamStaffing;
}

export interface Game {
  game_id: number;
  status: GameStatus;
  /** Team owning 9 cards and the first clue; chosen at random per game. */
  starting_team: Team;
  current_turn: CurrentTurn;
  score: Score;
  /** Exactly 25 cards, in fixed board order. */
  board: Card[];
  /** Non-null only after a competitive terminal result. */
  winner: Team | null;
  end_reason: GameEndReason | null;
  /** Present while the game is `PAUSED_FOR_PLAYERS`. */
  staffing?: Staffing;
  started_at: string;
  finished_at: string | null;
}
