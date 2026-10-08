/**
 * Incoming room invitations, live-only. They arrive as `room.invite.received` on the
 * chat socket, are never stored by the server, and disappear on reload. Accepting one
 * is an ordinary Join room request, which applies every normal join check.
 */

import { create } from 'zustand';

import type { RoomInviteReceivedEvent } from '@shared/types';

export interface RoomInvite {
  invite_id: string;
  expires_at: string;
  room_id: number;
  room_code: string;
  from_user: { user_id: number; username: string };
  sent_at: string;
}

interface InviteState {
  invites: RoomInvite[];

  receive: (event: RoomInviteReceivedEvent) => void;
  dismiss: (inviteId: string) => void;
  clear: () => void;
}

export const useInviteStore = create<InviteState>((set) => ({
  invites: [],

  receive: (event) =>
    set(({ invites }) => {
      const invite: RoomInvite = { sent_at: event.sent_at, ...event.payload };
      // The gateway drops expired deliveries; one that expired in transit is dropped too.
      if (Date.parse(invite.expires_at) <= Date.now()) return { invites };
      // A redelivered invitation is the same `invite_id`; a newer one to the same room
      // replaces the older.
      return {
        invites: [
          ...invites.filter(
            (i) => i.invite_id !== invite.invite_id && i.room_id !== invite.room_id,
          ),
          invite,
        ],
      };
    }),
  dismiss: (inviteId) =>
    set(({ invites }) => ({ invites: invites.filter((i) => i.invite_id !== inviteId) })),
  clear: () => set({ invites: [] }),
}));
