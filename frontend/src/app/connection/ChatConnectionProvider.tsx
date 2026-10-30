import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { attachChatConnection, chatEventHandlers } from '@features/chat/service/chatService';
import { useChatStore } from '@features/chat/store/chatStore';
import { applySocialEvent } from '@features/friends/service/socialEvents';
import { useInviteStore } from '@features/lobby/store/inviteStore';
import { setPlayerAvatar } from '@features/profile/hooks/usePlayerAvatars';
import { useOwnProfileStore } from '@features/profile/store/ownProfileStore';
import { useConnectionStore, useSessionStore } from '@shared/stores';
import type { SocialEvent } from '@shared/types';
import { ChatConnection } from '@shared/websocket';

/**
 * Friend and request changes go to the friends feature. A user's new username or avatar
 * also goes to every other place that shows them: their direct channels, the avatars of
 * room members, and, when it is the signed-in user's own change made in another tab, their
 * own profile and session.
 */
function applySocial(event: SocialEvent): void {
  applySocialEvent(event);
  if (event.type !== 'user.profile.updated') return;
  const { user_id: userId, username, avatar_url: avatarUrl } = event.payload;
  useChatStore.getState().updatePeer(userId, username, avatarUrl);
  setPlayerAvatar(userId, avatarUrl);
  if (userId === useSessionStore.getState().user?.user_id) {
    useSessionStore.getState().setUsername(username);
    const own = useOwnProfileStore.getState();
    own.setUsername(username);
    own.setAvatar(avatarUrl);
  }
}

/**
 * Owner of the per-user Chat Gateway socket (`/ws/v2/channels`).
 *
 * Separate from the room socket by contract (chat is not room-scoped), but owned at the
 * same app level so a single connection serves Lobby, Room and Game without any feature
 * opening its own. Chat events go to the chat feature, invitations to the lobby's store,
 * and social events to the friends feature and to every view of the user they change.
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
      onSocial: applySocial,
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
