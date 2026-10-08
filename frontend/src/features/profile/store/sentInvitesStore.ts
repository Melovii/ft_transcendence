/**
 * Room invitations this client has sent, for the Invite Sent state on a friend's profile.
 *
 * The server keeps no pending list (invitations are live-only), so this only remembers
 * what this tab sent. Each entry is scoped to the room it was sent for: an invitation to
 * one room never shows as sent in another. Nothing is persisted.
 */

import { create } from 'zustand';

const key = (roomId: number, userId: number) => `${roomId}:${userId}`;

interface SentInvitesState {
  sent: ReadonlySet<string>;
  markSent: (roomId: number, userId: number) => void;
  clear: () => void;
}

export const useSentInvitesStore = create<SentInvitesState>((set) => ({
  sent: new Set(),
  markSent: (roomId, userId) =>
    set(({ sent }) => ({ sent: new Set(sent).add(key(roomId, userId)) })),
  clear: () => set({ sent: new Set() }),
}));

/** Whether this tab has invited `userId` to `roomId`. */
export const useInviteSent = (roomId: number | null, userId: number): boolean =>
  useSentInvitesStore((state) => roomId !== null && state.sent.has(key(roomId, userId)));
