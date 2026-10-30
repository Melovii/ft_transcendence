import { useTranslation } from 'react-i18next';

import * as styles from '@features/chat/components/ChatWidget.styles';
import type { ChatPerson } from '@features/chat/components/ChatWidget';
import { useInviteToRoom } from '@features/profile/hooks/useInviteToRoom';
import type { InviteState } from '@features/profile/hooks/useInviteToRoom';
import type { Room } from '@shared/types';
import { Icon } from '@shared/ui';

function look(state: InviteState): keyof typeof styles.invite {
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

/**
 * INVITE beside a friend in the chat panel: the same room invitation as on the friend's
 * profile, into the room the user is in now, with the same states. Why it is unavailable —
 * the room started or is full, the friend is offline or already in a room — is its
 * accessible description and tooltip. The server checks everything again when it is sent.
 */
export function ChatInviteButton({ friend, room }: { friend: ChatPerson; room: Room }) {
  const { t } = useTranslation();
  const { state, invite } = useInviteToRoom(
    { user_id: friend.user_id, is_online: friend.is_online ?? false },
    room,
  );
  const actionable = state.status === 'READY' || state.status === 'FAILED';
  const why =
    state.status === 'UNAVAILABLE'
      ? t(`profile.invite.reason.${state.reason}`, { username: friend.username })
      : state.status === 'FAILED'
        ? t('profile.invite.failed')
        : state.status === 'SENT'
          ? t('profile.invite.sent', { username: friend.username })
          : undefined;

  return (
    <button
      type="button"
      onClick={() => void invite()}
      aria-disabled={!actionable}
      aria-busy={state.status === 'SENDING' || undefined}
      aria-label={t('chat.invite.label', { username: friend.username })}
      aria-description={why}
      title={why}
      className={styles.invite[look(state)]}
    >
      {state.status === 'SENT' && <Icon name="check" />}
      {t(`profile.invite.button.${state.status}`)}
    </button>
  );
}
