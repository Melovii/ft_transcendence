/**
 * Ready-made room scenarios for the mock room server.
 *
 * Each scenario drives the server only through the same moves real players make
 * (join, claim a seat, ready, clue, guess, leave), so every state it reaches is one the
 * contract allows and every event it emits is a real contract event.
 *
 * The local player sits on RED, or watches as a spectator; the others are the `MOCK_BOTS`.
 */

import type { CardColor } from '@shared/types';

import { MOCK_BOTS } from './mockRoomServer';
import type { MockRoomServer } from './mockRoomServer';

export const ROOM_SCENARIOS = [
  'empty',
  'room-waiting',
  'room-full',
  'countdown',
  'spymaster-turn',
  'operative-turn',
  'opponent-turn',
  'game-over',
  'assassin-loss',
  'paused',
  'spectating',
  'spectator-claim',
] as const;

export type RoomScenario = (typeof ROOM_SCENARIOS)[number];

export function isRoomScenario(value: string | undefined): value is RoomScenario {
  return (ROOM_SCENARIOS as readonly string[]).includes(value ?? '');
}

/**
 * Reveal the first unrevealed card of `color`, guessed by the active team's Operative
 * (or `byUserId`). Returns the revealed card id.
 */
export function guessByColor(server: MockRoomServer, color: CardColor, byUserId?: number): number {
  const card = server.state().game?.board.find((c) => !c.revealed && c.color === color);
  if (!card) throw new Error(`Mock sockets: no unrevealed ${color} card is left.`);
  server.guessCard(card.card_id, byUserId);
  return card.card_id;
}

export function applyRoomScenario(server: MockRoomServer, scenario: RoomScenario): void {
  const { redAgent, blueMaster, blueAgent, extraRed } = MOCK_BOTS;

  /** Four bots hold every seat and the local player watches. */
  const botsOnly = () => {
    for (const bot of [redAgent, extraRed, blueMaster, blueAgent]) server.playerJoin(bot);
    server.selectRole(redAgent.user_id, 'SPYMASTER', 'RED');
    server.selectRole(extraRed.user_id, 'OPERATIVE', 'RED');
    server.selectRole(blueMaster.user_id, 'SPYMASTER', 'BLUE');
    server.selectRole(blueAgent.user_id, 'OPERATIVE', 'BLUE');
    for (const bot of [redAgent, extraRed, blueMaster, blueAgent])
      server.setReady(bot.user_id, true);
    server.startGame('RED');
  };

  switch (scenario) {
    case 'empty':
      return;

    case 'room-waiting':
      // Mixed lobby: one ready Operative, one ready Spymaster, one still spectating.
      server.playerJoin(redAgent);
      server.playerJoin(blueMaster);
      server.playerJoin(blueAgent);
      server.selectRole(redAgent.user_id, 'OPERATIVE', 'RED');
      server.setReady(redAgent.user_id, true);
      server.selectRole(blueMaster.user_id, 'SPYMASTER', 'BLUE');
      server.setReady(blueMaster.user_id, true);
      return;

    case 'room-full':
      server.updateSettings(4);
      server.playerJoin(redAgent);
      server.playerJoin(blueMaster);
      server.playerJoin(blueAgent);
      return;

    case 'countdown':
      // Everyone ready: the server starts its 3-second countdown, then the game.
      server.configureStartable('OPERATIVE');
      return;

    case 'spymaster-turn':
      server.configureStartable('SPYMASTER');
      server.startGame('RED');
      return;

    case 'operative-turn':
      server.configureStartable('OPERATIVE');
      server.startGame('RED');
      server.submitClue('ocean', 2);
      return;

    case 'opponent-turn':
      server.configureStartable('OPERATIVE');
      server.startGame('BLUE');
      server.submitClue('forest', 2);
      return;

    case 'game-over':
      // RED reveals all nine of its cards under one clue; everyone is on the result.
      server.configureStartable('OPERATIVE');
      server.startGame('RED');
      server.submitClue('ocean', 9);
      for (let i = 0; i < 9; i += 1) guessByColor(server, 'RED');
      return;

    case 'assassin-loss':
      server.configureStartable('OPERATIVE');
      server.startGame('RED');
      server.submitClue('ocean', 2);
      guessByColor(server, 'ASSASSIN');
      return;

    case 'paused':
      // RED's Spymaster leaves mid-match: the shutdown countdown starts for RED.
      server.configureStartable('OPERATIVE');
      server.startGame('RED');
      server.submitClue('ocean', 2);
      server.playerLeave(redAgent.user_id, 'EXITED');
      return;

    case 'spectating':
      // The local player watches a running match.
      botsOnly();
      server.submitClue('ocean', 2);
      return;

    case 'spectator-claim':
      // RED's last Operative leaves; the watching local player can take the seat.
      botsOnly();
      server.playerLeave(extraRed.user_id, 'DISCONNECTED');
      return;
  }
}
