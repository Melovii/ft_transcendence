import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { ChatConnectionProvider } from '@app/connection/ChatConnectionProvider';
import { ChatInviteButton } from './ChatInviteButton';
import { ChatWidget } from '@features/chat/components/ChatWidget';
import type { ChatPerson, ChatRoomContext } from '@features/chat/components/ChatWidget';
import { useChatPanel } from '@features/chat/hooks/useChat';
import { useFriendList } from '@features/friends/hooks/useFriendList';
import { usePlayerAvatars } from '@features/profile/hooks/usePlayerAvatars';
import { useRoomStore } from '@features/room/store/roomStore';
import { ROUTES } from '@shared/constants';
import { openProfileModal, useSessionStore } from '@shared/stores';

/**
 * App-level chat mount.
 *
 * The chat widget is persistent on Lobby, Room and Game only — not on the public routes.
 * Mounting it here rather than inside a feature keeps it alive across those screens
 * (including while a profile modal is open) and stops features from importing each other
 * to render it: this is where the chat gets the friend list, the room the user is in and
 * the players' avatars, where its avatars and names open the shared Profile pop-up, and
 * where a friend's row gets the room Invite while the user is in a room.
 */
function isChatRoute(pathname: string): boolean {
  return pathname === ROUTES.lobby || pathname.startsWith('/room/');
}

export function ChatMount() {
  const { pathname } = useLocation();
  const status = useSessionStore((state) => state.status);
  const selfUserId = useSessionStore((state) => state.user?.user_id);

  if (status !== 'AUTHENTICATED' || selfUserId === undefined || !isChatRoute(pathname)) {
    return null;
  }

  return (
    <ChatConnectionProvider userId={selfUserId}>
      <ConnectedChat selfUserId={selfUserId} onLobby={pathname === ROUTES.lobby} />
    </ChatConnectionProvider>
  );
}

function ConnectedChat({ selfUserId, onLobby }: { selfUserId: number; onLobby: boolean }) {
  const friendList = useFriendList();
  const activeRoomId = useSessionStore((state) => state.activeRoomId);
  const room = useRoomStore((state) =>
    state.room && state.room.room_id === activeRoomId && state.room.status !== 'CLOSED'
      ? state.room
      : null,
  );
  const avatarFor = usePlayerAvatars(room ? room.players.map((p) => p.user_id) : []);
  const { isOpen } = useChatPanel();
  const { refresh } = friendList;

  // Presence is not pushed: read it again each time the panel opens.
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const friends: ChatPerson[] = useMemo(
    () =>
      friendList.friends.map((f) => ({
        user_id: f.user_id,
        username: f.username,
        avatar_url: f.avatar_url || null,
        is_online: f.is_online,
      })),
    [friendList.friends],
  );

  const friendById = useMemo(() => new Map(friends.map((f) => [f.user_id, f])), [friends]);

  const roomContext: ChatRoomContext | null = useMemo(
    () =>
      room && {
        room_id: room.room_id,
        members: room.players.map((p) => ({
          user_id: p.user_id,
          username: p.username,
          avatar_url:
            p.avatar_url || avatarFor(p.user_id) || friendById.get(p.user_id)?.avatar_url || null,
          // Room members carry no presence; a friend's comes from the friend list.
          is_online: friendById.get(p.user_id)?.is_online,
        })),
      },
    [room, avatarFor, friendById],
  );

  // Names seen this session, so a room message keeps its sender after they leave.
  const known = useRef(new Map<number, ChatPerson>());
  useEffect(() => {
    roomContext?.members.forEach((m) => known.current.set(m.user_id, m));
    friends.forEach((f) => known.current.set(f.user_id, f));
  }, [roomContext, friends]);

  // Invite needs a room to invite into; a friend already in it has nothing to join.
  const inviteFor = useCallback(
    (friend: ChatPerson) =>
      room?.status === 'WAITING' && !room.players.some((p) => p.user_id === friend.user_id) ? (
        <ChatInviteButton friend={friend} room={room} />
      ) : null,
    [room],
  );

  const personById = useCallback(
    (userId: number): ChatPerson | null =>
      friendById.get(userId) ??
      roomContext?.members.find((m) => m.user_id === userId) ??
      known.current.get(userId) ??
      null,
    [friendById, roomContext],
  );

  return (
    <ChatWidget
      place={
        onLobby
          ? 'LOBBY'
          : room?.players.find((p) => p.user_id === selfUserId)?.state === 'IN_LOBBY'
            ? 'READY_ROOM'
            : 'GAME'
      }
      selfUserId={selfUserId}
      friends={friends}
      friendsStatus={friendList.status}
      room={roomContext}
      personById={personById}
      onRetryFriends={friendList.retry}
      onOpenProfile={openProfileModal}
      inviteFor={inviteFor}
    />
  );
}
