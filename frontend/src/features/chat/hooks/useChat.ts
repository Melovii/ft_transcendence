/**
 * The chat hooks components use. They read the chat store and forward actions to the chat
 * service, so no component talks to the socket or to REST itself.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useConnectionStore } from '@shared/stores';

import {
  discardMessage,
  loadChannels,
  loadHistory,
  loadOlder,
  markSeen,
  openDirect,
  retryMessage,
  sendMessage,
  showChannel,
} from '../service/chatService';
import { selectTotalUnread, useChatStore } from '../store/chatStore';
import type { ChatTab, PendingMessage } from '../store/chatStore';

/** Unread messages across every usable conversation, for the launcher's badge. */
export const useChatUnread = (): number => useChatStore(selectTotalUnread);

/** Whether a message can be sent now: the socket is open and the gateway said ready. */
export function useChatOnline(): boolean {
  const ready = useChatStore((state) => state.ready);
  const open = useConnectionStore((state) => state.chat.status === 'OPEN');
  return ready && open;
}

/** The panel: open or closed, and which view and tab it shows. */
export function useChatPanel() {
  const { isOpen, view, tab } = useChatStore(
    useShallow((state) => ({ isOpen: state.isOpen, view: state.view, tab: state.tab })),
  );
  return {
    isOpen,
    view,
    tab,
    open: useCallback(() => useChatStore.getState().open(), []),
    close: useCallback(() => useChatStore.getState().close(), []),
    toggle: useCallback(() => {
      const state = useChatStore.getState();
      if (state.isOpen) state.close();
      else state.open();
    }, []),
    showList: useCallback(() => useChatStore.getState().setView({ kind: 'LIST' }), []),
    setTab: useCallback((next: ChatTab) => useChatStore.getState().setTab(next), []),
  };
}

/** The channels and their previews, as the conversation list shows them. */
export function useChatChannels() {
  const { channels, status, unread, openingPeerId, openFailedPeerId } = useChatStore(
    useShallow((state) => ({
      channels: state.channels,
      status: state.channelsStatus,
      unread: state.unread,
      openingPeerId: state.openingPeerId,
      openFailedPeerId: state.openFailedPeerId,
    })),
  );
  return {
    channels,
    status,
    unread,
    openingPeerId,
    openFailedPeerId,
    retry: useCallback(() => void loadChannels(), []),
    openChannel: useCallback((channelId: number) => showChannel(channelId), []),
    openDirect: useCallback((peerUserId: number) => void openDirect(peerUserId), []),
  };
}

/** Open the direct conversation with a friend, from anywhere in the app. */
export const openDirectChat = (peerUserId: number): void => void openDirect(peerUserId);

/** One conversation: its channel, messages, pending sends and the actions on it. */
export function useConversation(channelId: number) {
  const channel = useChatStore((state) => state.channels[channelId]);
  const history = useChatStore((state) => state.histories[channelId]);
  const pendingRecord = useChatStore((state) => state.pending);
  const online = useChatOnline();

  const pending: PendingMessage[] = useMemo(
    () =>
      Object.values(pendingRecord)
        .filter((p) => p.channel_id === channelId && !p.settled_message_id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [pendingRecord, channelId],
  );

  return {
    channel,
    history,
    pending,
    online,
    send: useCallback((draft: string) => sendMessage(channelId, draft), [channelId]),
    retry: useCallback((requestId: string) => retryMessage(requestId), []),
    discard: useCallback((requestId: string) => discardMessage(requestId), []),
    loadOlder: useCallback(() => void loadOlder(channelId), [channelId]),
    reload: useCallback(() => void loadHistory(channelId), [channelId]),
    markSeen: useCallback(() => markSeen(channelId), [channelId]),
  };
}
