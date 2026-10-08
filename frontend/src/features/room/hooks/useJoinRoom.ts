/**
 * Join Room by code: `GET /api/v2/rooms/lookup/{room_code}`, then
 * `POST /api/v2/rooms/{room_id}/members`.
 *
 * A room that is counting down or playing still takes players: they join as spectators and
 * may claim a free seat from inside.
 *
 * As soon as the field holds a well-formed code, the lookup runs and the dialog previews
 * the room's occupancy and status. The preview only decides what the dialog offers; Join
 * is still sent to the server, which may answer that the room filled up or started in the
 * meantime, and that answer is what the dialog shows. A second Join while one is in flight
 * is dropped before it reaches the network.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@shared/api';
import { ROOM_CODE_PATTERN } from '@shared/types';
import type { RoomLookupResponse } from '@shared/types';

import { joinRoom, lookupRoomByCode } from '../api';
import { canJoin, joinAvailability } from '../model/capacity';
import type { JoinAvailability } from '../model/capacity';
import { joinFailure } from '../model/entry';
import type { EntryFailure } from '../model/entry';
import { ENTRY_CONFIRMATION_MS } from './useCreateRoom';
import { useEnterRoom } from './useEnterRoom';

/** Pause after the last keystroke before a complete code is looked up. */
const LOOKUP_DELAY_MS = 250;

export const ROOM_CODE_LENGTH = 6;

/** Join answers that mean the previewed room has filled up or started since the lookup. */
const STALE_PREVIEW_CODES = ['ROOM_FULL', 'ROOM_NOT_JOINABLE'];

const isApiErrorCode = (error: unknown, codes: string[]): boolean =>
  error instanceof ApiError && codes.includes(error.code);

export type JoinRoomStatus = 'IDLE' | 'FINDING' | 'JOINING' | 'JOINED';

/** Uppercase letters and digits only, at most six: what the field accepts as typed. */
export const normalizeRoomCode = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);

export function useJoinRoom() {
  const enter = useEnterRoom();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<RoomLookupResponse | null>(null);
  const [status, setStatus] = useState<JoinRoomStatus>('IDLE');
  const [failure, setFailure] = useState<EntryFailure | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  /** Increases with every edit, so an answer for an older code is ignored. */
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const lookUp = useCallback(async (roomCode: string, request: number) => {
    setStatus('FINDING');
    try {
      const room = await lookupRoomByCode(roomCode);
      if (!mounted.current || request !== generation.current) return null;
      setPreview(room);
      setStatus('IDLE');
      return room;
    } catch (error) {
      if (!mounted.current || request !== generation.current) return null;
      setFailure(joinFailure(error));
      setStatus('IDLE');
      return null;
    }
  }, []);

  const changeCode = useCallback((value: string) => {
    const next = normalizeRoomCode(value);
    generation.current += 1;
    setCode(next);
    setPreview(null);
    setFailure(null);
    if (!pending.current) setStatus('IDLE');
  }, []);

  // A complete code is looked up once typing pauses.
  useEffect(() => {
    if (!ROOM_CODE_PATTERN.test(code) || pending.current) return;
    const request = generation.current;
    const timer = setTimeout(() => void lookUp(code, request), LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [code, lookUp]);

  const availability: JoinAvailability | null = preview ? joinAvailability(preview) : null;

  const submit = useCallback(async () => {
    if (pending.current) return;
    if (!ROOM_CODE_PATTERN.test(code)) {
      setFailure({ kind: 'field', message: 'room.join.errors.format' });
      return;
    }

    pending.current = true;
    setFailure(null);
    const request = generation.current;
    const room = preview ?? (await lookUp(code, request));
    if (!mounted.current) return;
    if (!room || !canJoin(joinAvailability(room))) {
      pending.current = false;
      if (room) setStatus('IDLE');
      return;
    }

    setStatus('JOINING');
    try {
      const joined = await joinRoom(room.room_id);
      if (!mounted.current) return;
      setStatus('JOINED');
      await new Promise((resolve) => setTimeout(resolve, ENTRY_CONFIRMATION_MS));
      if (mounted.current) enter(joined);
    } catch (error) {
      if (!mounted.current) return;
      pending.current = false;
      const result = joinFailure(error);
      setStatus('IDLE');
      if (result.kind === 'field' && isApiErrorCode(error, STALE_PREVIEW_CODES)) {
        // The room changed since the preview; show its current occupancy and status.
        setPreview(null);
        await lookUp(code, request);
      }
      if (mounted.current) setFailure(result);
    }
  }, [code, enter, lookUp, preview]);

  return { code, changeCode, preview, availability, status, failure, submit };
}
