/**
 * Create Room: one `POST /api/v2/rooms` with the chosen capacity.
 *
 * A second submit while the request is in flight is dropped before it reaches the
 * network, so a double click never creates two rooms. The dialog only moves on once the
 * server has answered with the new room; it then confirms, and the room opens shortly after
 * or as soon as the user asks for it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ROOM_CAPACITY } from '@shared/types';
import type { Room } from '@shared/types';

import { createRoom } from '../api';
import { createFailure } from '../model/entry';
import type { BannerFailure } from '../model/entry';
import { useEnterRoom } from './useEnterRoom';

/** How long "Room created!" stays up before the room opens. */
export const ENTRY_CONFIRMATION_MS = 900;

export type CreateRoomStatus = 'IDLE' | 'CREATING' | 'CREATED' | 'FAILED';

export function useCreateRoom() {
  const enter = useEnterRoom();
  const [maxPlayers, setMaxPlayers] = useState<number>(ROOM_CAPACITY.default);
  const [status, setStatus] = useState<CreateRoomStatus>('IDLE');
  const [failure, setFailure] = useState<BannerFailure | null>(null);
  const [created, setCreated] = useState<Room | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const entered = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const enterCreated = useCallback(() => {
    if (!created || entered.current) return;
    entered.current = true;
    enter(created);
  }, [created, enter]);

  useEffect(() => {
    if (!created) return;
    const timer = setTimeout(enterCreated, ENTRY_CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [created, enterCreated]);

  const changeMaxPlayers = useCallback((value: number) => {
    setMaxPlayers(Math.min(ROOM_CAPACITY.max, Math.max(ROOM_CAPACITY.min, value)));
  }, []);

  const submit = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setStatus('CREATING');
    setFailure(null);
    try {
      const room = await createRoom({ max_players: maxPlayers });
      if (!mounted.current) return;
      setCreated(room);
      setStatus('CREATED');
    } catch (error) {
      if (!mounted.current) return;
      pending.current = false;
      setFailure(createFailure(error));
      setStatus('FAILED');
    }
  }, [maxPlayers]);

  return { maxPlayers, changeMaxPlayers, status, failure, submit, enterCreated };
}
