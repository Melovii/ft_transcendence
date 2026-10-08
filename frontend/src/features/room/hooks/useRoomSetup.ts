/**
 * The Ready Room's own commands — team, role, spectating, ready, room size and turn timer —
 * with the feedback the controls show while one is in flight and after the server turns one
 * down.
 *
 * A spectator picks a team first and a role second, but the server takes both in one
 * command, so the picked team is held here as a draft (`draftTeam`) until the role is chosen.
 *
 * Nothing changes on screen when a command is sent. The member's new team, role or ready
 * state appears when the server's `room.player.updated` and `room.state` arrive, so a
 * command that loses a race (two players taking the same Spymaster seat) never shows a
 * result the server did not accept. One command runs at a time; a second press while one
 * is in flight is dropped.
 *
 * Nothing is sent while the room connection is down or still restoring its snapshot, and
 * nothing is resent after a reconnect: whether a Ready pressed just before a drop counted
 * is for the fresh snapshot to say. A drop also clears any message on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import { useConnectionStore } from '@shared/stores';
import { RoomCommandError } from '@shared/websocket';
import type { PlayingRole, Team, TurnTimerSeconds } from '@shared/types';

import { useRoomCommands } from './useRoomCommands';

export type SetupAction = 'team' | 'role' | 'ready' | 'capacity' | 'timer';

export interface SetupFeedback {
  action: SetupAction;
  /** Translation key of the message. */
  message: string;
}

function messageFor(action: SetupAction, error: unknown): string {
  const code = error instanceof RoomCommandError ? error.code : null;
  switch (code) {
    case 'ROLE_CONFLICT':
      return 'room.ready.errors.roleConflict';
    case 'TEAM_REQUIRED':
      return 'room.ready.errors.teamRequired';
    case 'ROLE_REQUIRED':
      return 'room.ready.errors.roleRequired';
    case 'INVALID_ROOM_STATE':
      return 'room.ready.errors.locked';
    case 'POST_GAME_PENDING':
      return 'room.ready.errors.postGamePending';
    case 'NOT_HOST':
      return 'room.ready.errors.notHost';
    case 'INVALID_PAYLOAD':
      return action === 'timer' ? 'room.ready.errors.timer' : 'room.ready.errors.capacity';
    case 'NOT_SENT':
    case 'CONNECTION_LOST':
      return 'room.ready.errors.offline';
    default:
      return 'room.ready.errors.generic';
  }
}

export function useRoomSetup() {
  const commands = useRoomCommands();
  const connection = useRoomConnection();
  const online = useConnectionStore((state) => state.room.status === 'OPEN');
  const [pending, setPending] = useState<SetupAction | null>(null);
  const [feedback, setFeedback] = useState<SetupFeedback | null>(null);
  const [draftTeam, setDraftTeam] = useState<Team | null>(null);
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
    async (action: SetupAction, send: () => Promise<unknown>) => {
      if (busy.current || connection.getStatus() !== 'OPEN') return;
      busy.current = true;
      setPending(action);
      setFeedback(null);
      try {
        await send();
      } catch (error) {
        // A lost answer is not a refusal; the snapshot shows whether the command counted.
        const lost = error instanceof RoomCommandError && error.code === 'CONNECTION_LOST';
        if (mounted.current && !lost) setFeedback({ action, message: messageFor(action, error) });
      } finally {
        busy.current = false;
        if (mounted.current) setPending(null);
      }
    },
    [connection],
  );

  return {
    pending,
    feedback,
    draftTeam,
    setDraftTeam,
    dismissFeedback: useCallback(() => setFeedback(null), []),
    selectTeam: useCallback(
      (team: Team) => run('team', () => commands.selectTeam(team)),
      [commands, run],
    ),
    selectRole: useCallback(
      (team: Team, role: PlayingRole) => run('role', () => commands.selectRole(team, role)),
      [commands, run],
    ),
    spectate: useCallback(() => run('role', () => commands.spectate()), [commands, run]),
    setReady: useCallback(
      (ready: boolean) => run('ready', () => commands.setReady(ready)),
      [commands, run],
    ),
    updateMaxPlayers: useCallback(
      (maxPlayers: number) =>
        run('capacity', () => commands.updateSettings({ max_players: maxPlayers })),
      [commands, run],
    ),
    updateTurnTimer: useCallback(
      (seconds: TurnTimerSeconds) =>
        run('timer', () => commands.updateSettings({ turn_timer_seconds: seconds })),
      [commands, run],
    ),
  };
}

export type RoomSetup = ReturnType<typeof useRoomSetup>;
