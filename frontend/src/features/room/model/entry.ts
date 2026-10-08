/**
 * What the Create Room and Join Room dialogs show when entering a room fails.
 *
 * Only translation keys come out of here. The server's own `message` is never shown, so
 * no request detail reaches the screen. The server stays authoritative: a room the lookup
 * showed as open can still turn out full or started by the time Join is sent, and that
 * answer is what the dialog reports.
 */

import { ApiError } from '@shared/api';

export interface EntryAlert {
  tone: 'error' | 'success';
  title: string;
  body: string;
}

/**
 * A failed create or join. `field` is the code field's own error; `alert` is the dialog's
 * result banner; `activeRoomId` is set when the user already belongs to a room, so the
 * dialog can offer to go back to it.
 */
export type EntryFailure =
  | { kind: 'field'; message: string }
  | { kind: 'alert'; alert: EntryAlert }
  | { kind: 'active-room'; alert: EntryAlert; activeRoomId: number };

/** A failure the dialog reports in its banner rather than under the code field. */
export type BannerFailure = Exclude<EntryFailure, { kind: 'field' }>;

const alert = (key: string): EntryAlert => ({
  tone: 'error',
  title: `room.feedback.${key}Title`,
  body: `room.feedback.${key}Body`,
});

/** The user already has an active room; both Create and Join answer this way. */
function activeRoomFailure(error: ApiError): BannerFailure | null {
  if (error.code !== 'ALREADY_IN_ROOM') return null;
  const roomId = error.details.room_id;
  if (typeof roomId !== 'number') return { kind: 'alert', alert: alert('alreadyInRoom') };
  return { kind: 'active-room', alert: alert('alreadyInRoom'), activeRoomId: roomId };
}

export function createFailure(error: unknown): BannerFailure {
  if (!(error instanceof ApiError)) return { kind: 'alert', alert: alert('createFailed') };
  const active = activeRoomFailure(error);
  if (active) return active;
  if (error.code === 'RATE_LIMITED') return { kind: 'alert', alert: alert('rateLimited') };
  return { kind: 'alert', alert: alert('createFailed') };
}

/** Failures of the code lookup and of the Join request itself. */
export function joinFailure(error: unknown): EntryFailure {
  if (!(error instanceof ApiError)) return { kind: 'alert', alert: alert('joinFailed') };
  const active = activeRoomFailure(error);
  if (active) return active;

  switch (error.code) {
    // An unknown code and a room that closed since the lookup read the same.
    case 'ROOM_NOT_FOUND':
      return { kind: 'field', message: 'room.join.errors.notFound' };
    case 'VALIDATION_ERROR':
      return { kind: 'field', message: 'room.join.errors.format' };
    case 'ROOM_FULL':
      return { kind: 'field', message: 'room.join.errors.full' };
    case 'ROOM_NOT_JOINABLE':
      return { kind: 'field', message: 'room.join.errors.notJoinable' };
    case 'RATE_LIMITED':
      return { kind: 'alert', alert: alert('rateLimited') };
    default:
      return { kind: 'alert', alert: alert('joinFailed') };
  }
}
