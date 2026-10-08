/**
 * Join from a room invitation: the ordinary `POST /api/v2/rooms/{room_id}/members`.
 *
 * An invitation is not a pass. The server applies every normal join check, so a room that
 * filled up, started or closed since the invitation was sent answers like any other join,
 * and that answer is what the invitation shows. A second Join while one is in flight is
 * dropped before it reaches the network.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { joinRoom } from '../api';
import { joinFailure } from '../model/entry';
import { useEnterRoom } from './useEnterRoom';

export type JoinInviteStatus = 'IDLE' | 'JOINING' | 'FAILED';

export function useJoinInvite() {
  const enter = useEnterRoom();
  const [status, setStatus] = useState<JoinInviteStatus>('IDLE');
  /** Translation key of why the last join failed. */
  const [failure, setFailure] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const join = useCallback(
    async (roomId: number): Promise<boolean> => {
      if (pending.current) return false;
      pending.current = true;
      setStatus('JOINING');
      setFailure(null);
      try {
        const room = await joinRoom(roomId);
        if (mounted.current) enter(room);
        return true;
      } catch (error) {
        if (!mounted.current) return false;
        const result = joinFailure(error);
        if (result.kind !== 'field') setFailure(result.alert.title);
        // The code came with the invitation, so a room that is not found has closed.
        else if (result.message === 'room.join.errors.notFound') setFailure('room.invites.closed');
        else setFailure(result.message);
        setStatus('FAILED');
        return false;
      } finally {
        pending.current = false;
      }
    },
    [enter],
  );

  return { status, failure, join };
}
