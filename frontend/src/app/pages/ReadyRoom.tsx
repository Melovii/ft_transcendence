import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import mascotArtwork from '@assets/ready-room/ready-room-mascot.svg';
import { ProfileMenu } from '@features/profile/components/ProfileMenu';
import { usePlayerAvatars } from '@features/profile/hooks/usePlayerAvatars';
import { RoomCapacity, RoomCode, RoomSettingsInfo } from '@features/room/components/RoomHeader';
import { CountdownOverlay, KickDialog } from '@features/room/components/RoomOverlays';
import {
  ReadyButton,
  SetupDialog,
  SetupFeedback,
  SetupPanel,
  SetupSummary,
} from '@features/room/components/SetupPanel';
import { Spectators, TeamPanel } from '@features/room/components/TeamPanel';
import { useKickMember } from '@features/room/hooks/useKickMember';
import { useRoomSetup } from '@features/room/hooks/useRoomSetup';
import {
  findMember,
  participantCount,
  postGamePending,
  readyCount,
  rosters,
  roomPhase,
  isFull,
  setupLocked,
} from '@features/room/model/readyRoom';
import { useRoomStore } from '@features/room/store/roomStore';
import { useConnectionStore, useSessionStore } from '@shared/stores';
import type { Room, RoomMember } from '@shared/types';
import { Button, Icon, Toast, ToastStack } from '@shared/ui';
import { cn } from '@shared/utils';

import * as styles from './ReadyRoom.styles';

const CANCEL_NOTICE_MS = 5_000;

function LeaveButton({ onLeave, className }: { onLeave: () => void; className: string }) {
  const { t } = useTranslation();
  return (
    <Button
      theme="outline"
      variant="secondary"
      sizeClassName={cn(styles.leave, className)}
      block
      onClick={onLeave}
      aria-haspopup="dialog"
      className={styles.leaveSurface}
    >
      {t('room.leave.action')}
      <Icon name="logout" className={styles.leaveIcon} />
    </Button>
  );
}

/** Why the server stopped the countdown, shown for a few seconds once it happens. */
function CountdownCancelledNotice() {
  const { t } = useTranslation();
  const cancellation = useRoomStore((state) => state.countdownCancellation);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!cancellation) return;
    const timer = setTimeout(() => setDismissed(cancellation.eventId), CANCEL_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [cancellation]);

  if (!cancellation || dismissed === cancellation.eventId) return null;

  return (
    <ToastStack>
      <div className={styles.toasts}>
        <Toast
          tone="neutral"
          icon="timer"
          onDismiss={() => setDismissed(cancellation.eventId)}
          dismissLabel={t('common.dismiss')}
        >
          {t(`room.countdown.cancelled.${cancellation.reason}`, {
            username: cancellation.username ?? t('room.countdown.someone'),
          })}
        </Toast>
      </div>
    </ToastStack>
  );
}

/**
 * The Ready Room: the staging screen between Room Discovery and the board.
 *
 * Everyone arrives as a spectator. Players claim a team and a role, then press Ready; whoever
 * stays out watches. The Room Owner (the host) can remove any other member and owns the
 * room's settings; everyone else sees the same values read-only. Every value on screen comes from the
 * room snapshot the server keeps current over the room socket, so a player who joins,
 * leaves or changes their setup appears for everyone without a reload, and a refresh or a
 * reconnect rebuilds the same screen from a fresh snapshot. There is no start button: the
 * server starts the countdown itself once its start predicate holds, and the room moves to
 * the board when the server announces the game.
 */
export function ReadyRoom({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.user?.user_id);
  const socketOpen = useConnectionStore((state) => state.room.status === 'OPEN');
  const secondsRemaining = useRoomStore((state) => state.secondsRemaining);
  const setup = useRoomSetup();
  const kick = useKickMember();
  const [setupOpen, setSetupOpen] = useState(false);

  const me: RoomMember | null = findMember(room, userId);
  const teams = useMemo(() => rosters(room), [room]);
  const profileAvatar = usePlayerAvatars(room.players.map((p) => p.user_id));
  const avatarFor = (id: number) =>
    room.players.find((p) => p.user_id === id)?.avatar_url || profileAvatar(id);
  const host = room.host_user_id === null ? null : findMember(room, room.host_user_id);
  const phase = roomPhase(room);
  const locked = setupLocked(room);
  const onKick = userId !== undefined && room.host_user_id === userId ? kick.request : undefined;
  const member = { avatarFor, selfId: userId, selfOnline: socketOpen, onKick };

  // The countdown locks the setup, so a dialog left open would only offer dead controls.
  useEffect(() => {
    if (locked) setSetupOpen(false);
  }, [locked]);

  const counter =
    isFull(room) && room.status === 'WAITING'
      ? t('room.ready.counterFull', { count: room.player_count, max: room.max_players })
      : t('room.ready.counter', { ready: readyCount(room), count: participantCount(room) });

  return (
    <main className={styles.page}>
      <div className={styles.main}>
        <div className={styles.column}>
          <h1 className={styles.title}>
            {host ? t('room.ready.title', { host: host.username }) : t('room.ready.titleFallback')}
          </h1>
          <RoomCode code={room.room_code} className={styles.code} />
          <p className={styles.hint}>{t('room.ready.shareHint')}</p>
          {userId !== undefined && (
            <>
              <RoomCapacity room={room} userId={userId} setup={setup} className={styles.capacity} />
              <RoomSettingsInfo
                room={room}
                userId={userId}
                setup={setup}
                className={styles.settings}
              />
            </>
          )}

          {me && <SetupSummary me={me} onChange={() => setSetupOpen(true)} disabled={locked} />}

          <div className={styles.hero}>
            <img src={mascotArtwork} alt="" className={styles.mascot} />
            <p className={styles.headline}>{t(`room.ready.phase.${phase}.title`)}</p>
            <p className={styles.subtitle}>
              {t(`room.ready.phase.${phase}.body`, {
                count: room.player_count,
                max: room.max_players,
                pending: postGamePending(room).length,
              })}
            </p>
          </div>

          <div className={styles.teams}>
            <TeamPanel roster={teams.red} className={styles.team} {...member} />
            <TeamPanel roster={teams.blue} className={styles.team} {...member} />
          </div>
          <Spectators
            members={teams.spectators}
            avatarFor={avatarFor}
            selfId={userId}
            onKick={onKick}
            className={styles.choosing}
          />

          <div className={styles.foot}>
            <p className={styles.counter}>{counter}</p>
            {me && <ReadyButton room={room} me={me} setup={setup} size={styles.readyInline} />}
            {!setupOpen && <SetupFeedback setup={setup} />}
            <LeaveButton onLeave={onLeave} className={styles.leaveInline} />
          </div>
        </div>
      </div>

      <aside aria-labelledby="your-setup-title" className={styles.sidebar}>
        <ProfileMenu variant="plain" className={styles.profile} />
        <h2 id="your-setup-title" className={styles.setupTitle}>
          {t('room.ready.setupTitle')}
        </h2>
        {me && (
          <>
            <SetupPanel room={room} me={me} setup={setup} className={styles.setupPanel} />
            <ReadyButton room={room} me={me} setup={setup} className={styles.readyButton} />
          </>
        )}
        <p className={styles.sidebarCounter}>{counter}</p>
        <SetupFeedback setup={setup} className={styles.feedback} />
        <div aria-hidden="true" className={styles.divider} />
        <LeaveButton onLeave={onLeave} className={styles.leaveSidebar} />
      </aside>

      {setupOpen && me && (
        <SetupDialog room={room} me={me} setup={setup} onClose={() => setSetupOpen(false)} />
      )}
      {room.status === 'COUNTDOWN' && <CountdownOverlay seconds={secondsRemaining} />}
      <KickDialog kick={kick} inMatch={false} />
      <CountdownCancelledNotice />
    </main>
  );
}
