/**
 * App-level modal state.
 *
 * Profile and Settings are modals, not routes, and they open from Lobby, Room and Game.
 * Routing the request through this store is what keeps those features from importing
 * each other: a caller publishes an intent, and the app-level `ModalHost` renders it.
 */

import { create } from 'zustand';

/** Extend as further app-level modals appear. */
export type ModalRequest = { kind: 'profile'; userId: number } | { kind: 'settings' };

interface ModalState {
  active: ModalRequest | null;
  open: (request: ModalRequest) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  active: null,
  open: (active) => set({ active }),
  close: () => set({ active: null }),
}));

/** Convenience for the common case, usable from any feature. */
export const openProfileModal = (userId: number): void =>
  useModalStore.getState().open({ kind: 'profile', userId });

/** Opens the signed-in user's Settings over the current screen. */
export const openSettingsModal = (): void => useModalStore.getState().open({ kind: 'settings' });
