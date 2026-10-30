/**
 * Game domain store — the authoritative game state as the server projected it for
 * this recipient.
 *
 * Two rules this store exists to enforce:
 *   - the frontend never computes a winner; only `game.ended` or a snapshot of the
 *     completed game is terminal, and a cancelled game has no winner at all;
 *   - an Operative's projection has `color: null` on unrevealed cards, and no code may
 *     treat that absence as something to fill in.
 *
 * It is fed from the same room connection as the room store — Game opens no socket.
 */

import { create } from 'zustand';

import type { CurrentTurn, Game, RoomServerEvent, StaffingDeparture } from '@shared/types';

interface GameState {
  game: Game | null;
  /**
   * Who left and why, from the `game.staffing.required` that paused the game. A snapshot
   * does not carry it, so after a reload the pause is explained without the name.
   */
  departure: StaffingDeparture | null;

  /** Apply one room-stream event; non-game events are ignored. */
  applyEvent: (event: RoomServerEvent) => void;
  clear: () => void;
}

/**
 * Apply a turn update from an event. An event may carry only part of the turn (the clue
 * event, for one, repeats the clue beside `current_turn` rather than inside it), so the
 * fields it leaves out keep their value, and a turn waiting for its clue never shows the
 * previous one.
 */
function nextTurn(previous: CurrentTurn, update: Partial<CurrentTurn>): CurrentTurn {
  const merged: CurrentTurn = { ...previous, ...update };
  return merged.phase === 'WAITING_FOR_CLUE' ? { ...merged, clue: null } : merged;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  departure: null,

  applyEvent: (event) => {
    const { game } = get();
    switch (event.type) {
      case 'room.state':
      case 'game.started': {
        const next = event.payload.room.game;
        // The departure belongs to the pause it explains; it goes once the pause does.
        const paused = next?.current_turn.phase === 'PAUSED_FOR_PLAYERS';
        const sameGame = next !== null && next.game_id === game?.game_id;
        set({ game: next, departure: paused && sameGame ? get().departure : null });
        return;
      }
      case 'game.clue.submitted': {
        if (!game) return;
        const { clue, guesses_remaining: guesses, current_turn: turn } = event.payload;
        set({
          game: {
            ...game,
            current_turn: nextTurn(game.current_turn, {
              ...turn,
              clue,
              guesses_remaining: guesses,
            }),
          },
        });
        return;
      }
      case 'game.card.revealed': {
        if (!game) return;
        const { card } = event.payload;
        set({
          game: {
            ...game,
            score: event.payload.score,
            current_turn: nextTurn(game.current_turn, event.payload.current_turn),
            board: game.board.map((c) => (c.card_id === card.card_id ? card : c)),
            winner: event.payload.winner ?? game.winner,
            end_reason: event.payload.end_reason ?? game.end_reason,
          },
        });
        return;
      }
      case 'game.score.updated':
        if (game) set({ game: { ...game, score: event.payload.score } });
        return;
      case 'game.turn.changed':
        if (game) {
          set({
            game: {
              ...game,
              current_turn: nextTurn(game.current_turn, event.payload.current_turn),
              score: event.payload.score,
            },
          });
        }
        return;
      case 'game.ended': {
        if (!game) return;
        const { revealed_card: revealed } = event.payload;
        set({
          game: {
            ...game,
            status: event.payload.game_status,
            winner: event.payload.winner,
            end_reason: event.payload.end_reason,
            score: event.payload.score,
            finished_at: event.payload.finished_at,
            current_turn: { ...game.current_turn, phase: 'GAME_OVER', deadline_at: null },
            board: game.board.map((c) => (c.card_id === revealed.card_id ? revealed : c)),
          },
        });
        return;
      }
      case 'game.staffing.required':
        if (!game) return;
        set({
          departure: event.payload.departure,
          game: {
            ...game,
            staffing: event.payload.staffing,
            current_turn: { ...game.current_turn, phase: 'PAUSED_FOR_PLAYERS', deadline_at: null },
          },
        });
        return;
      case 'game.staffing.restored': {
        if (!game) return;
        const next: Game = { ...game, current_turn: event.payload.current_turn };
        delete next.staffing;
        set({ game: next, departure: null });
        return;
      }
      case 'game.history.appended': {
        if (!game || event.payload.game_id !== game.game_id) return;
        const { entry } = event.payload;
        // The snapshot may already hold it; entries are applied once, in `seq` order.
        if (game.history.some((e) => e.seq >= entry.seq)) return;
        set({ game: { ...game, history: [...game.history, entry] } });
        return;
      }
      case 'game.cancelled':
        if (!game) return;
        set({
          game: {
            ...game,
            status: event.payload.game_status,
            winner: null,
            end_reason: event.payload.end_reason,
            score: event.payload.score,
            finished_at: event.payload.finished_at,
            current_turn: { ...game.current_turn, phase: 'GAME_OVER', deadline_at: null },
          },
        });
        return;
      default:
        return;
    }
  },

  clear: () => set({ game: null, departure: null }),
}));
