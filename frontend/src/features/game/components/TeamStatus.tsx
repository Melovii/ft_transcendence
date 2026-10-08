import { useTranslation } from 'react-i18next';

import { openProfileModal } from '@shared/stores';
import type { RoomMember } from '@shared/types';
import { AvatarImage, ButtonIcon } from '@shared/ui';
import { cn } from '@shared/utils';

import type { TeamLineup } from '../model/lineup';
import * as styles from './TeamStatus.styles';

/** Resolves a member's avatar from the member list, or from their profile as a fallback. */
export type AvatarLookup = (userId: number) => string | null;

/** The Room Owner's Kick, for every player but themself; absent for everyone else. */
export type KickLookup = ((member: RoomMember) => void) | undefined;

function Player({
  member,
  avatarFor,
  onKick,
}: {
  member: RoomMember;
  avatarFor: AvatarLookup;
  onKick: KickLookup;
}) {
  const { t } = useTranslation();
  const url = avatarFor(member.user_id);

  return (
    <li className={styles.kickable}>
      <button
        type="button"
        onClick={() => openProfileModal(member.user_id)}
        aria-haspopup="dialog"
        aria-label={t('game.roster.openProfile', { username: member.username })}
        className={styles.player}
      >
        <span className={styles.avatar}>
          <AvatarImage
            src={url}
            className={styles.avatarImage}
            placeholderClassName={styles.avatarPlaceholder}
          />
        </span>
        <span aria-hidden="true" title={member.username} className={styles.playerName}>
          {member.username}
        </span>
      </button>
      {onKick && (
        <ButtonIcon
          icon="kick"
          theme="outline"
          variant="secondary"
          sizeClassName={styles.kickSize}
          onClick={() => onKick(member)}
          aria-haspopup="dialog"
          aria-label={t('room.kick.action', { username: member.username })}
          title={t('room.kick.action', { username: member.username })}
          className={styles.kick}
        />
      )}
    </li>
  );
}

/**
 * A team's lineup beside the desktop board: its Operatives, then its Spymaster. Each
 * player opens their profile over the game; the Room Owner can also remove any of them.
 */
export function TeamStatusCard({
  lineup,
  avatarFor,
  kickFor,
  className,
}: {
  lineup: TeamLineup;
  avatarFor: AvatarLookup;
  /** The Room Owner's Kick for one player; `undefined` where it does not apply. */
  kickFor?: (member: RoomMember) => KickLookup;
  className?: string;
}) {
  const { t } = useTranslation();
  const tone = styles.tones[lineup.team];

  return (
    <section aria-label={t(`game.teamName.${lineup.team}`)} className={cn(styles.card, className)}>
      <h2 className={cn(styles.cardTitle, tone.title)}>{t(`game.teamName.${lineup.team}`)}</h2>
      <h3 className={cn(styles.roleLabel, tone.label)}>{t('game.roster.operatives')}</h3>
      <ul className={styles.players}>
        {lineup.operatives.map((member) => (
          <Player
            key={member.user_id}
            member={member}
            avatarFor={avatarFor}
            onKick={kickFor?.(member)}
          />
        ))}
      </ul>
      <div aria-hidden="true" className={styles.divider} />
      <h3 className={cn(styles.roleLabel, tone.label)}>{t('game.roster.spymaster')}</h3>
      <ul className={styles.players}>
        {lineup.spymasters.map((member) => (
          <Player
            key={member.user_id}
            member={member}
            avatarFor={avatarFor}
            onKick={kickFor?.(member)}
          />
        ))}
      </ul>
    </section>
  );
}

/** A team's lineup as two lines of names, at the foot of the phone and tablet board. */
export function TeamSummary({ lineup, className }: { lineup: TeamLineup; className?: string }) {
  const { t } = useTranslation();
  const names = (members: RoomMember[]) =>
    members.length ? members.map((m) => m.username).join(', ') : t('game.roster.nobody');

  return (
    <section
      aria-label={t(`game.teamName.${lineup.team}`)}
      className={cn(styles.summary, className)}
    >
      <h2 className={cn(styles.summaryTitle, styles.tones[lineup.team].summary)}>
        {t(`game.teamName.${lineup.team}`)}
      </h2>
      <p className={styles.summaryLine}>
        {t('game.roster.spymasterLine', { names: names(lineup.spymasters) })}
      </p>
      <p className={styles.summaryLine}>
        {t('game.roster.operativesLine', { names: names(lineup.operatives) })}
      </p>
    </section>
  );
}
