/**
 * The Room Owner's Kick: pick a member, confirm, send `room.member.kick`.
 *
 * Nothing changes on screen when the kick is sent. The member disappears for everyone when
 * the server's `room.player.left` and `room.state` arrive, and the confirmation closes once
 * the server has acknowledged the kick. A refusal stays in the dialog. If the member is
 * already gone, or this player stops being the host while the dialog is open, the dialog
 * closes on its own, since there is nothing left to confirm.
 *
 * A kick asked for from a member's profile pop-up arrives as the room store's
 * `kickRequest` and opens the same confirmation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import { useSessionStore } from '@shared/stores';
import type { RoomMember } from '@shared/types';
import { RoomCommandError } from '@shared/websocket';

import { useRoomStore } from '../store/roomStore';
import { useRoomCommands } from './useRoomCommands';

export type KickStatus = 'CONFIRMING' | 'KICKING' | 'FAILED';

function messageFor(error: unknown): string {
  const code = error instanceof RoomCommandError ? error.code : null;
  switch (code) {
    case 'NOT_HOST':
      return 'room.kick.errors.notHost';
    case 'TARGET_NOT_ROOM_MEMBER':
      return 'room.kick.errors.gone';
    case 'CANNOT_KICK_SELF':
      return 'room.kick.errors.self';
    case 'INVALID_ROOM_STATE':
      return 'room.kick.errors.closed';
    case 'NOT_SENT':
    case 'CONNECTION_LOST':
      return 'room.ready.errors.offline';
    default:
      return 'room.ready.errors.generic';
  }
}

export function useKickMember() {
  const commands = useRoomCommands();
  const connection = useRoomConnection();
  const [target, setTarget] = useState<RoomMember | null>(null);
  const [status, setStatus] = useState<KickStatus>('CONFIRMING');
  const [failure, setFailure] = useState<string | null>(null);
  const busy = useRef(false);

  const userId = useSessionStore((state) => state.user?.user_id);
  const isHost = useRoomStore((state) => state.room?.host_user_id === userId);
  const targetPresent = useRoomStore(
    (state) => target !== null && state.room?.players.some((p) => p.user_id === target.user_id),
  );

  const close = useCallback(() => {
    if (busy.current) return;
    setTarget(null);
    setFailure(null);
    setStatus('CONFIRMING');
  }, []);

  // Host transfer or a member who already left leaves nothing to confirm.
  useEffect(() => {
    if (target && (!isHost || !targetPresent) && !busy.current) close();
  }, [close, isHost, target, targetPresent]);

  const request = useCallback(
    (member: RoomMember) => {
      if (member.user_id === userId) return;
      setFailure(null);
      setStatus('CONFIRMING');
      setTarget(member);
    },
    [userId],
  );

  const kickRequest = useRoomStore((state) => state.kickRequest);
  useEffect(() => {
    if (kickRequest === null) return;
    const { room, requestKick } = useRoomStore.getState();
    requestKick(null);
    const member = room?.players.find((p) => p.user_id === kickRequest);
    if (member && isHost && !busy.current) request(member);
  }, [isHost, kickRequest, request]);

  const confirm = useCallback(async () => {
    if (!target || busy.current || connection.getStatus() !== 'OPEN') return;
    busy.current = true;
    setStatus('KICKING');
    setFailure(null);
    try {
      await commands.kick(target.user_id);
      busy.current = false;
      close();
    } catch (error) {
      busy.current = false;
      setFailure(messageFor(error));
      setStatus('FAILED');
    }
  }, [close, commands, connection, target]);

  return { target, status, failure, request, confirm, close };
}

export type KickMember = ReturnType<typeof useKickMember>;
