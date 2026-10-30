import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';

import { useRoomConnection } from '@app/connection/roomConnectionContext';
import { endSignedInState } from '@app/session/endSignedInState';
import { useGameStore } from '@features/game/store/gameStore';
import { LeaveRoomDialog } from '@features/room/components/RoomOverlays';
import { useLeaveRoom } from '@features/room/hooks/useLeaveRoom';
import { useRoomStore } from '@features/room/store/roomStore';
import type { RoomExit } from '@features/room/store/roomStore';
import { showToast, useConnectionStore, useSessionStore } from '@shared/stores';
import { ErrorState, LoadingState } from '@shared/ui';

import { GameScreen } from './GameScreen';
import { ReadyRoom } from './ReadyRoom';
import * as styles from './ReadyRoom.styles';

const EXIT_NOTICE: Partial<Record<RoomExit, string>> = {
  KICKED: 'room.recovery.kicked',
  POST_GAME_TIMEOUT: 'room.recovery.postGameTimeout',
  SEAT_UNAVAILABLE: 'room.recovery.seatUnavailable',
  INSUFFICIENT_PLAYERS: 'room.recovery.insufficientPlayers',
};

/**
 * The room route. It shows the screen that matches the player's own state in the server's
 * snapshot — the Ready Room while they are in the room's lobby, the Game Board while they
 * play a match (or join a paused one to take its free seat), and its result until they decide — so a refresh lands on the
 * right screen from the fresh snapshot, never from navigation history. After a match the
 * room may already be waiting for the next one while this player is still on the result.
 *
 * Until the first snapshot arrives the route shows a loading state rather than an empty
 * room. A room that closed, or that the player no longer belongs to (they were removed by
 * the host, or did not decide on a result in time), clears the room from the session;
 * route recovery then takes the player to Room Discovery, where a toast says what happened.
 *
 * Leaving is always explicit. LEAVE ROOM and LEAVE GAME ask first and tell the server, and
 * a Back or any other navigation away from the room is held for the same confirmation, so
 * nobody leaves a seat taken by nobody. A result has nothing left to confirm, so leaving
 * it, by Exit or by Back, tells the server and goes straight to the Lobby.
 */
export function RoomPage() {
  const { t } = useTranslation();
  const connection = useRoomConnection();
  const roomId = connection.roomId;
  const room = useRoomStore((state) => state.room);
  const game = useGameStore((state) => state.game);
  const socket = useConnectionStore((state) => state.room);
  const leave = useLeaveRoom();
  const exit = useRoomStore((state) => state.exit);

  const userId = useSessionStore((state) => state.user?.user_id);
  const me = room?.players.find((p) => p.user_id === userId) ?? null;
  // A snapshot without the player means the server no longer counts them in the room; while
  // they are leaving on purpose, that is the leave itself arriving first.
  const removed = room !== null && leave.status !== 'LEAVING' && me === null;
  const closed =
    room?.status === 'CLOSED' ||
    (socket.status === 'CLOSED' && socket.closeReason === 'ROOM_NOT_FOUND');
  const unavailable =
    closed || removed || (socket.status === 'CLOSED' && socket.closeReason === 'NOT_ROOM_MEMBER');
  const sessionEnded = socket.status === 'CLOSED' && socket.closeReason === 'SESSION_INVALID';

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false;
    // Read at navigation time: leaving clears the active room just before it navigates.
    const member = useSessionStore.getState().activeRoomId === roomId;
    const status = useRoomStore.getState().room?.status;
    return member && status !== undefined && status !== 'CLOSED';
  });

  // The membership is over: say why, and let route recovery take the player to the Lobby.
  useEffect(() => {
    if (!unavailable) return;
    if (useSessionStore.getState().activeRoomId !== roomId) return;
    showToast({
      message:
        (exit && EXIT_NOTICE[exit]) ?? (closed ? 'room.recovery.closed' : 'room.recovery.removed'),
      tone: 'error',
      icon: 'warning',
    });
    useSessionStore.getState().setActiveRoomId(null);
  }, [closed, exit, roomId, unavailable]);

  // A revoked session cannot reconnect; the route guard takes the user to Log In.
  useEffect(() => {
    if (sessionEnded) endSignedInState('EXPIRED');
  }, [sessionEnded]);

  // Leaving a finished room needs no confirmation: a held navigation leaves at once.
  const { request: requestLeave, action: leaveAction } = leave;
  const blocked = blocker.state === 'blocked';
  useEffect(() => {
    if (!blocked || leaveAction.confirm) return;
    blocker.reset?.();
    requestLeave();
  }, [blocked, blocker, leaveAction.confirm, requestLeave]);

  const leaveOpen = leaveAction.confirm
    ? leave.status !== 'IDLE' || blocked
    : leave.status === 'FAILED';
  const cancelLeave = () => {
    leave.cancel();
    if (blocker.state === 'blocked') blocker.reset();
  };
  const confirmLeave = () => {
    // The held navigation is dropped; leaving takes the player to Room Discovery itself.
    if (blocker.state === 'blocked') blocker.reset();
    void leave.confirm();
  };

  let screen;
  if (unavailable) {
    screen = (
      <main className={styles.state}>
        <LoadingState label={t('room.loading')} />
      </main>
    );
  } else if (!room) {
    screen =
      socket.status === 'CLOSED' && !sessionEnded ? (
        <main className={styles.state}>
          <ErrorState
            title={t('room.connection.failedTitle')}
            description={t('room.connection.failedBody')}
            onRetry={() => connection.connect()}
            retryLabel={t('common.retry')}
          />
        </main>
      ) : (
        <main className={styles.state}>
          <LoadingState label={t('room.loading')} />
        </main>
      );
  } else if (me?.state === 'IN_LOBBY') {
    screen = <ReadyRoom room={room} onLeave={leave.request} />;
  } else if (game) {
    screen = (
      <GameScreen
        room={room}
        game={game}
        leaving={leave.status === 'LEAVING'}
        onLeave={leave.request}
        overlaysHidden={leaveOpen}
      />
    );
  } else {
    screen = (
      <main className={styles.state}>
        <LoadingState label={t('game.loading')} />
      </main>
    );
  }

  return (
    <>
      {screen}
      {leaveOpen && !unavailable && (
        <LeaveRoomDialog
          action={leave.action}
          status={leave.status}
          failed={leave.status === 'FAILED'}
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </>
  );
}
