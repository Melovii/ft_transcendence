/**
 * The player's game commands — give a clue, pick a card, pass — with the feedback the
 * board shows while one is in flight and after the server turns one down.
 *
 * Nothing on the board changes when a command is sent. The clue, the revealed card, the
 * score and the next turn appear when the server's `game.*` events arrive, for this client
 * and every other one alike, so a pick that loses a race with a teammate's never shows a
 * result the server did not accept. One command runs at a time; a second press while one
 * is in flight is dropped. That lock only spares the server a repeated request — the
 * server serializes the room's commands itself.
 *
 * Nothing is sent while the room connection is down or still restoring its snapshot, and
 * nothing is ever resent after a reconnect: a pick whose answer was lost with the socket
 * may or may not have been played, and the fresh snapshot is what says which. A drop
 * clears the pending pick and any message on screen, since both belong to a state that
 * may no longer be current.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import { useConnectionStore } from '@shared/stores';
import { RoomCommandError } from '@shared/websocket';

export type GameAction = 'clue' | 'guess' | 'pass';

export interface GameFeedback {
  action: GameAction;
  /** Translation key of the message. */
  message: string;
}

/**
 * Errors that mean this client's view is behind the server's (the card was revealed, the
 * turn moved on, the match ended). The board is then rebuilt from a fresh snapshot rather
 * than patched around.
 */
const STALE_STATE = new Set([
  'CARD_ALREADY_REVEALED',
  'GAME_ALREADY_FINISHED',
  'INVALID_ROOM_STATE',
  'NOT_YOUR_TURN',
  'NO_GUESSES_REMAINING',
]);

function messageFor(error: unknown): string {
  const code = error instanceof RoomCommandError ? error.code : null;
  switch (code) {
    case 'INVALID_CLUE':
      return 'game.errors.invalidClue';
    case 'INVALID_CLUE_NUMBER':
      return 'game.errors.invalidNumber';
    case 'CARD_ALREADY_REVEALED':
      return 'game.errors.alreadyRevealed';
    case 'INVALID_CARD':
      return 'game.errors.invalidCard';
    case 'NO_GUESSES_REMAINING':
      return 'game.errors.noGuesses';
    case 'NOT_YOUR_TURN':
    case 'INVALID_ROOM_STATE':
      return 'game.errors.notYourTurn';
    case 'ROLE_FORBIDDEN':
      return 'game.errors.roleForbidden';
    case 'GAME_ALREADY_FINISHED':
      return 'game.errors.finished';
    case 'NOT_SENT':
    case 'CONNECTION_LOST':
      return 'game.errors.offline';
    default:
      return 'game.errors.generic';
  }
}

export function useGameActions() {
  const connection = useRoomConnection();
  const online = useConnectionStore((state) => state.room.status === 'OPEN');
  const [pending, setPending] = useState<GameAction | null>(null);
  /** The card whose pick is on its way to the server. */
  const [pickedCard, setPickedCard] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<GameFeedback | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A message about a state the connection has since lost would only mislead.
  useEffect(() => {
    if (!online) setFeedback(null);
  }, [online]);

  const run = useCallback(
    async (action: GameAction, send: () => Promise<unknown>): Promise<boolean> => {
      if (busy.current || connection.getStatus() !== 'OPEN') return false;
      busy.current = true;
      setPending(action);
      setFeedback(null);
      try {
        await send();
        return true;
      } catch (error) {
        if (error instanceof RoomCommandError && STALE_STATE.has(error.code)) connection.resync();
        // A lost answer is not a refusal: the Reconnecting overlay covers it, and the
        // snapshot shows whether the command was played.
        const lost = error instanceof RoomCommandError && error.code === 'CONNECTION_LOST';
        if (mounted.current && !lost) setFeedback({ action, message: messageFor(error) });
        return false;
      } finally {
        busy.current = false;
        if (mounted.current) {
          setPending(null);
          setPickedCard(null);
        }
      }
    },
    [connection],
  );

  return {
    pending,
    pickedCard,
    feedback,
    dismissFeedback: useCallback(() => setFeedback(null), []),
    /** Resolves `true` once the server accepted the clue. */
    submitClue: useCallback(
      (word: string, number: number) =>
        run('clue', () => connection.request('game.clue.submit', { word, number })),
      [connection, run],
    ),
    guessCard: useCallback(
      (cardId: number) => {
        if (busy.current || connection.getStatus() !== 'OPEN') return;
        setPickedCard(cardId);
        void run('guess', () => connection.request('game.card.guess', { card_id: cardId }));
      },
      [connection, run],
    ),
    passTurn: useCallback(
      () => void run('pass', () => connection.request('game.turn.pass', {})),
      [connection, run],
    ),
  };
}

export type GameActions = ReturnType<typeof useGameActions>;
