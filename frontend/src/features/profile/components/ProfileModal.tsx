import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { Room } from '@shared/types';
import { AvatarImage, Button, Dialog, Icon, Skeleton } from '@shared/ui';
import { cn } from '@shared/utils';

import { useInviteToRoom } from '../hooks/useInviteToRoom';
import type { InviteState, InviteUnavailableReason } from '../hooks/useInviteToRoom';
import { useProfile } from '../hooks/useProfile';
import type { ProfileView } from '../hooks/useProfile';
import { useReportUser } from '../hooks/useReportUser';
import * as styles from './ProfileModal.styles';
import { ReportView } from './ReportView';

/**
 * The friendship between the signed-in user and the profile's player, as the app layer
 * reads it from the friends feature. The profile feature only presents it.
 */
export interface FriendshipControl {
  status: 'LOADING' | 'READY' | 'ERROR';
  isFriend: boolean;
  change: 'ADDING' | 'REMOVING' | null;
  failed: 'ADDING' | 'REMOVING' | null;
  add: () => void;
  remove: () => void;
  retry: () => void;
}

export interface ProfileModalProps {
  userId: number;
  isSelf: boolean;
  onClose: () => void;
  /** Another player's profile only. */
  friendship?: FriendshipControl | undefined;
  /** The room the signed-in user is in now, from its live snapshot; `null` outside one. */
  room: Room | null;
  /** Told when the server refuses an invite, so what it found stale can be read again. */
  onInviteRefused?: ((reason: InviteUnavailableReason) => void) | undefined;
  /** Opens the direct chat with this player. Offered to friends only, as chat allows. */
  onMessage?: (() => void) | undefined;
  /** The Room Owner's Kick for a member of their room; absent for everyone else. */
  onKick?: (() => void) | undefined;
  /** The own profile's GAME HISTORY. */
  history?: ReactNode;
}

/**
 * The Profile pop-up, over the screen that opened it: Room Discovery, the Ready Room or the
 * Game Board, which stays mounted and live behind it. The app-level `ModalHost` renders
 * it; features open it with `openProfileModal(userId)`.
 *
 * One pop-up serves every profile and adapts to whose it is. The own profile shows the
 * stats and GAME HISTORY. Another player's shows the stats and the friend action, and for
 * a friend INVITE, which invites them into the user's current room when that room can take
 * them. What the actions offer is derived from the live friend list and room snapshot, and
 * the server decides every action again when it is sent.
 *
 * Another player's profile also offers REPORT at its foot. The report form takes the
 * profile's place inside the same pop-up, and Close steps back from it to the profile. It
 * is never offered on the user's own profile. For the Room Owner, a member of their room's
 * profile also offers REMOVE FROM ROOM there, which asks the room to confirm the kick.
 *
 * It is mounted once per user (`key`), so while one player's profile loads nothing of the
 * previous one can show.
 */
export function ProfileModal({
  userId,
  isSelf,
  onClose,
  friendship,
  room,
  onInviteRefused,
  onMessage,
  onKick,
  history,
}: ProfileModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { profile, status, retry, refresh } = useProfile(userId, isSelf);
  const [view, setView] = useState<'PROFILE' | 'REPORT'>('PROFILE');
  // Only a room this player is in too gives the report its room context.
  const reportRoomId = room && room.players.some((p) => p.user_id === userId) ? room.room_id : null;
  const report = useReportUser(userId, reportRoomId);
  const reportSending = report.state.status === 'SENDING';
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reportRef = useRef<HTMLButtonElement>(null);

  // A view swap replaces the focused control: the report's heading takes focus, and
  // coming back to the profile returns it to REPORT.
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    (view === 'REPORT' ? titleRef : reportRef).current?.focus();
  }, [view]);

  // A refusal over presence means the profile's `is_online` is stale: read it again.
  const onRefused = useCallback(
    (reason: InviteUnavailableReason) => {
      if (reason === 'OFFLINE') refresh();
      onInviteRefused?.(reason);
    },
    [onInviteRefused, refresh],
  );

  return (
    <Dialog
      labelledBy={titleId}
      closeLabel={t(view === 'REPORT' ? 'profile.report.back' : 'profile.close')}
      onClose={view === 'REPORT' ? () => setView('PROFILE') : onClose}
      closable={!reportSending}
      className={styles.card}
    >
      {view === 'REPORT' && profile ? (
        <ReportView
          username={profile.username}
          state={report.state}
          onSubmit={(reason, details) => void report.submit(reason, details)}
          onBack={() => setView('PROFILE')}
          titleId={titleId}
          titleRef={titleRef}
        />
      ) : status === 'READY' && profile ? (
        <>
          <ProfileHeader profile={profile} titleId={titleId} />
          {!isSelf && friendship && (
            <ProfileActions
              profile={profile}
              friendship={friendship}
              room={room}
              onInviteRefused={onRefused}
              onMessage={onMessage}
            />
          )}
          <ProfileStats profile={profile} />
          {isSelf && history}
          {!isSelf && onKick && (
            <Button
              theme="link"
              variant="muted"
              icon="kick"
              sizeClassName={styles.report}
              onClick={onKick}
              aria-haspopup="dialog"
              className={styles.reportPlacement}
            >
              {t('room.kick.fromProfile')}
            </Button>
          )}
          {!isSelf && (
            <ReportButton
              buttonRef={reportRef}
              reported={
                report.state.status === 'SENT' || report.state.status === 'ALREADY_REPORTED'
              }
              onReport={() => setView('REPORT')}
            />
          )}
        </>
      ) : status === 'LOADING' ? (
        <ProfileSkeleton titleId={titleId} />
      ) : (
        <ProfileNotice
          titleId={titleId}
          kind={status === 'NOT_FOUND' ? 'notFound' : 'error'}
          onRetry={retry}
        />
      )}
    </Dialog>
  );
}

function ProfileHeader({ profile, titleId }: { profile: ProfileView; titleId: string }) {
  const { t } = useTranslation();
  const presence = profile.is_online ? 'online' : 'offline';

  return (
    <div className={styles.header}>
      <span className={styles.avatarFrame}>
        <span className={styles.avatar}>
          <AvatarImage
            src={profile.avatar_url}
            className={styles.avatarImage}
            placeholderClassName={styles.avatarPlaceholder}
          />
        </span>
        {profile.is_online && <span aria-hidden="true" className={styles.onlineDot} />}
      </span>
      <div className={styles.identity}>
        <h2 id={titleId} className={styles.name}>
          {profile.username}
        </h2>
        <p aria-hidden="true" className={styles.handle}>
          @{profile.username}
        </p>
        <p className={cn(styles.statusBase, styles.status[presence])}>
          <span aria-hidden="true" className={styles.statusDot} />
          {t(`profile.presence.${presence}`)}
        </p>
      </div>
    </div>
  );
}

/** REPORT at the foot of another player's profile; Reported once the server has it. */
function ReportButton({
  buttonRef,
  reported,
  onReport,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  reported: boolean;
  onReport: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      ref={buttonRef}
      theme="link"
      variant="muted"
      icon={reported ? 'check' : 'flag'}
      sizeClassName={styles.report}
      onClick={() => !reported && onReport()}
      aria-disabled={reported || undefined}
      className={styles.reportPlacement}
    >
      {t(reported ? 'profile.report.reported' : 'profile.report.action')}
    </Button>
  );
}

function ProfileStats({ profile }: { profile: ProfileView }) {
  const { t } = useTranslation();
  const stats = [
    ['wins', profile.wins],
    ['losses', profile.losses],
    ['level', profile.level],
  ] as const;

  // Level is the server's own value (`1 + floor(wins / 5)`), shown as it arrives.
  return (
    <div className={styles.statsBlock}>
      <dl className={styles.stats}>
        {stats.map(([key, value]) => (
          <div key={key} className={styles.stat}>
            <dt className={styles.statLabel}>{t(`profile.stats.${key}`)}</dt>
            <dd className={styles.statValue}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.statsCaption}>
        {t('profile.stats.played', { count: profile.matches_played })}
      </p>
    </div>
  );
}

function ProfileActions({
  profile,
  friendship,
  room,
  onInviteRefused,
  onMessage,
}: {
  profile: ProfileView;
  friendship: FriendshipControl;
  room: Room | null;
  onInviteRefused?: ((reason: InviteUnavailableReason) => void) | undefined;
  onMessage?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const hintId = useId();
  const { state: invite, invite: sendInvite } = useInviteToRoom(profile, room, onInviteRefused);
  const isFriend = friendship.status === 'READY' && friendship.isFriend;
  const inviteActionable = invite.status === 'READY' || invite.status === 'FAILED';

  // A friendship problem outranks the invite's own line: it is the newer news.
  const hint: Hint | null =
    friendship.status === 'ERROR'
      ? { tone: 'error', text: t('profile.friend.loadFailed'), onRetry: friendship.retry }
      : friendship.failed
        ? { tone: 'error', text: t(`profile.friend.failed.${friendship.failed}`) }
        : isFriend
          ? inviteHint(invite, profile.username, t)
          : null;

  return (
    <div className={styles.actions}>
      <div className={styles.actionRow}>
        {friendship.status === 'LOADING' ? (
          <span aria-hidden="true" className={styles.friendSkeleton} />
        ) : (
          <FriendButton friendship={friendship} isFriend={isFriend} hintId={hintId} />
        )}
        {/* Invites go to friends only; for anyone else there is nothing to offer. */}
        {isFriend && (
          <button
            type="button"
            onClick={() => void sendInvite()}
            aria-disabled={!inviteActionable}
            aria-busy={invite.status === 'SENDING'}
            aria-describedby={hintId}
            className={styles.invite[inviteLook(invite)]}
          >
            {invite.status === 'SENT' && <Icon name="check" />}
            {t(`profile.invite.button.${invite.status}`)}
          </button>
        )}
        {/* Direct chat is friend-only, so Message is offered to friends only. */}
        {isFriend && onMessage && (
          <Button
            theme="outline"
            sizeClassName={styles.action}
            onClick={onMessage}
            className={styles.message}
          >
            {t('profile.message')}
          </Button>
        )}
      </div>
      <HintLine id={hintId} hint={hint} />
    </div>
  );
}

function FriendButton({
  friendship,
  isFriend,
  hintId,
}: {
  friendship: FriendshipControl;
  isFriend: boolean;
  hintId: string;
}) {
  const { t } = useTranslation();
  const busy = friendship.change !== null;
  const label = busy
    ? t(`profile.friend.${friendship.change === 'ADDING' ? 'adding' : 'removing'}`)
    : t(isFriend ? 'profile.friend.remove' : 'profile.friend.add');

  return (
    <Button
      variant={isFriend ? 'neutral' : 'primary'}
      sizeClassName={styles.action}
      onClick={() => {
        if (busy) return;
        if (isFriend) friendship.remove();
        else friendship.add();
      }}
      aria-disabled={busy}
      aria-busy={busy}
      aria-describedby={hintId}
      className={styles.friend}
    >
      {label}
    </Button>
  );
}

type Hint = { tone: 'neutral' | 'success' | 'error'; text: string; onRetry?: () => void };

function inviteLook(state: InviteState): keyof typeof styles.invite {
  switch (state.status) {
    case 'SENDING':
      return 'sending';
    case 'SENT':
      return 'sent';
    case 'UNAVAILABLE':
      return 'unavailable';
    default:
      return 'ready';
  }
}

function inviteHint(
  state: InviteState,
  username: string,
  t: ReturnType<typeof useTranslation>['t'],
): Hint | null {
  switch (state.status) {
    case 'SENT':
      return { tone: 'success', text: t('profile.invite.sent', { username }) };
    case 'UNAVAILABLE':
      return { tone: 'neutral', text: t(`profile.invite.reason.${state.reason}`, { username }) };
    case 'FAILED':
      return { tone: 'error', text: t('profile.invite.failed') };
    default:
      return null;
  }
}

/** The one line under the actions that says why a button is as it is. Announced politely. */
function HintLine({ id, hint }: { id: string; hint: Hint | null }) {
  const { t } = useTranslation();
  return (
    <p id={id} aria-live="polite" className={cn(styles.hintBase, hint && styles.hint[hint.tone])}>
      {hint?.text}
      {hint?.onRetry && (
        <button type="button" onClick={hint.onRetry} className={styles.hintAction}>
          {t('profile.retry')}
        </button>
      )}
    </p>
  );
}

function ProfileSkeleton({ titleId }: { titleId: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col gap-[inherit]">
      <h2 id={titleId} className="sr-only">
        {t('profile.loading')}
      </h2>
      <div aria-hidden="true" className={styles.skeletonHeader}>
        <Skeleton shape="circle" className={styles.skeletonAvatar} />
        <span className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="w-2/5" />
          <Skeleton className="w-1/4" />
        </span>
      </div>
      <div aria-hidden="true" className={styles.stats}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} shape="block" className={styles.skeletonStat} />
        ))}
      </div>
    </div>
  );
}

function ProfileNotice({
  titleId,
  kind,
  onRetry,
}: {
  titleId: string;
  kind: 'notFound' | 'error';
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role={kind === 'error' ? 'alert' : undefined} className={styles.notice}>
      <Icon name={kind === 'error' ? 'disconnected' : 'playersOff'} className={styles.noticeIcon} />
      <h2 id={titleId} className={styles.noticeTitle}>
        {t(`profile.${kind}.title`)}
      </h2>
      <p className={styles.noticeBody}>{t(`profile.${kind}.body`)}</p>
      {kind === 'error' && (
        <Button sizeClassName={styles.retry} onClick={onRetry} className={styles.retryPlacement}>
          {t('profile.retry')}
        </Button>
      )}
    </div>
  );
}
