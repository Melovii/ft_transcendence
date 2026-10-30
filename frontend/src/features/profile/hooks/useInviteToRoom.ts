/**
 * INVITE for a friend — on their profile and beside them in the chat panel: invite them
 * into the room the signed-in user is in now, through the one room invitation endpoint.
 *
 * `room` is that room as its live snapshot has it, or `null` outside a room. The button's
 * state is derived from it on every render, so a room that fills up, starts, or gains the
 * friend as a member turns the button unavailable at once, and a reconnect's fresh
 * snapshot re-decides it. The server checks everything again when the invite is sent
 * (friendship, room `WAITING` with nobody still on a result and not full, the friend
 * connected to chat and in no room) and its
 * answer wins: a refusal becomes the Unavailable reason, which holds only while the room
 * and the friend's presence stay as they were when it was given.
 *
 * Invite Sent is remembered per room (`sentInvitesStore`), so it does not follow the
 * friend into another room. One request at a time: a press while one is in flight is
 * ignored.
 */

import { useCallback, useRef, useState } from 'react';

import type { ApiError } from '@shared/api';
import type { Room } from '@shared/types';

import { inviteFriend } from '../api';
import { useInviteSent, useSentInvitesStore } from '../store/sentInvitesStore';
import type { ProfileView } from './useProfile';

export type InviteUnavailableReason =
  | 'NO_ACTIVE_ROOM'
  | 'ROOM_NOT_JOINABLE'
  | 'ROOM_FULL'
  | 'IN_YOUR_ROOM'
  | 'OFFLINE'
  | 'IN_ROOM'
  | 'NOT_FRIENDS';

export type InviteState =
  | { status: 'READY' }
  | { status: 'SENDING' }
  | { status: 'SENT' }
  | { status: 'UNAVAILABLE'; reason: InviteUnavailableReason }
  | { status: 'FAILED' };

const REASON_BY_CODE: Record<string, InviteUnavailableReason> = {
  USER_OFFLINE: 'OFFLINE',
  NOT_FRIENDS: 'NOT_FRIENDS',
  USER_IN_ROOM: 'IN_ROOM',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_NOT_JOINABLE: 'ROOM_NOT_JOINABLE',
  ROOM_NOT_FOUND: 'NO_ACTIVE_ROOM',
  NOT_ROOM_MEMBER: 'NO_ACTIVE_ROOM',
};

/** The friend as the invite needs them: who they are and whether they are online. */
export type InviteTarget = Pick<ProfileView, 'user_id' | 'is_online'>;

/** What a server refusal depended on; when any of it changes, the refusal no longer holds. */
function contextOf(room: Room | null, friend: InviteTarget): string {
  return room
    ? `${room.room_id}|${room.status}|${room.post_game ? 1 : 0}|${room.player_count}|${room.max_players}|${friend.is_online}`
    : 'none';
}

/** The reason the room itself rules the invite out, before any request. */
function roomReason(room: Room | null, friendId: number): InviteUnavailableReason | null {
  if (!room || room.status === 'CLOSED') return 'NO_ACTIVE_ROOM';
  if (room.players.some((p) => p.user_id === friendId)) return 'IN_YOUR_ROOM';
  // A room is invitable only while it waits and nobody is still on the last result.
  if (room.status !== 'WAITING' || room.post_game) return 'ROOM_NOT_JOINABLE';
  if (room.player_count >= room.max_players) return 'ROOM_FULL';
  return null;
}

export function useInviteToRoom(
  friend: InviteTarget,
  room: Room | null,
  /** Told when the server refuses, so the caller can re-read what it found stale. */
  onRefused?: (reason: InviteUnavailableReason) => void,
) {
  const roomId = room?.room_id ?? null;
  const sent = useInviteSent(roomId, friend.user_id);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<{ reason: InviteUnavailableReason; context: string }>();
  const inFlight = useRef(false);

  const context = contextOf(room, friend);
  const blocked = roomReason(room, friend.user_id);

  let state: InviteState;
  if (sending) state = { status: 'SENDING' };
  else if (blocked) state = { status: 'UNAVAILABLE', reason: blocked };
  else if (sent) state = { status: 'SENT' };
  else if (!friend.is_online) state = { status: 'UNAVAILABLE', reason: 'OFFLINE' };
  else if (refusal && refusal.context === context) {
    state = { status: 'UNAVAILABLE', reason: refusal.reason };
  } else if (failed) state = { status: 'FAILED' };
  else state = { status: 'READY' };

  const canSend = state.status === 'READY' || state.status === 'FAILED';

  const invite = useCallback(async () => {
    if (inFlight.current || !canSend || roomId === null) return;
    inFlight.current = true;
    setSending(true);
    setFailed(false);
    try {
      await inviteFriend(roomId, friend.user_id);
      useSentInvitesStore.getState().markSent(roomId, friend.user_id);
    } catch (cause) {
      const reason = REASON_BY_CODE[(cause as ApiError).code];
      if (reason) {
        setRefusal({ reason, context });
        onRefused?.(reason);
      } else {
        setFailed(true);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [canSend, context, friend.user_id, onRefused, roomId]);

  return { state, invite };
}
