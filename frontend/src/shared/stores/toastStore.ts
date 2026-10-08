/**
 * App-level toasts: short notices that outlive the screen that raised them.
 *
 * A caller publishes a notice — a translation key, never a finished string, so it follows
 * the selected language — and the app-level toast host renders it over whatever screen
 * comes next. Route recovery uses it to explain why the user landed on the Lobby instead
 * of the room they asked for.
 */

import { create } from 'zustand';

import type { IconName, ToastTone } from '@shared/ui';

export interface ToastNotice {
  id: number;
  /** Translation key of the message. */
  message: string;
  tone: ToastTone;
  icon?: IconName;
}

interface ToastState {
  toasts: ToastNotice[];
  show: (notice: Omit<ToastNotice, 'id'>) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (notice) =>
    set(({ toasts }) => ({
      // The same message twice in a row is one notice, not a stack of copies.
      toasts: [...toasts.filter((t) => t.message !== notice.message), { ...notice, id: nextId++ }],
    })),
  dismiss: (id) => set(({ toasts }) => ({ toasts: toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Convenience for the common case, usable from any feature. */
export const showToast = (notice: Omit<ToastNotice, 'id'>): void =>
  useToastStore.getState().show(notice);
