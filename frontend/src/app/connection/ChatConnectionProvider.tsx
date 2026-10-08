import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { attachChatConnection, chatEventHandlers } from '@features/chat/service/chatService';
import { useInviteStore } from '@features/lobby/store/inviteStore';
import { useConnectionStore } from '@shared/stores';
import { ChatConnection } from '@shared/websocket';

/**
 * Owner of the per-user Chat Gateway socket (`/ws/v2/channels`).
 *
 * Separate from the room socket by contract (chat is not room-scoped), but owned at the
 * same app level so a single connection serves Lobby, Room and Game without any feature
 * opening its own. Chat events go to the chat feature, invitations to the lobby's store.
 */
export function ChatConnectionProvider({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
  const setChatStatus = useConnectionStore((state) => state.setChatStatus);
  const [connection, setConnection] = useState<ChatConnection | null>(null);

  useEffect(() => {
    const instance = new ChatConnection({
      ...chatEventHandlers,
      onStatusChange: (status, reason) => {
        setChatStatus(status, reason);
        chatEventHandlers.onStatusChange(status);
      },
      onInvite: (event) => useInviteStore.getState().receive(event),
    });

    attachChatConnection(instance, userId);
    setConnection(instance);
    instance.connect();

    return () => {
      instance.disconnect();
      attachChatConnection(null, null);
      setConnection(null);
    };
  }, [setChatStatus, userId]);

  // The chat feature reaches the socket through `attachChatConnection`; its UI waits for it.
  if (!connection) return null;

  return children;
}
