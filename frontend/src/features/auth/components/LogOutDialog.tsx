import { useTranslation } from 'react-i18next';

import type { PlayingRole } from '@shared/types';
import { ConfirmDialog } from '@shared/ui';

/**
 * Log Out? — asked only while the player plays in a running match, because logging out
 * then counts as leaving it: a leave penalty on their profile, heavier for a Spymaster,
 * and their team's room may close if nobody takes the seat. It is the Leave Game wording.
 * Stay, the safe choice, sits on the left and the committing Log Out on the right. While
 * the request runs the dialog cannot be dismissed, so its result is always shown.
 */
export function LogOutDialog({
  role,
  pending,
  failed,
  onConfirm,
  onCancel,
}: {
  /** The player's role in the running match. */
  role: PlayingRole;
  pending: boolean;
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('auth.logOut.title')}
      body={t(`auth.logOut.body.${role}`)}
      error={failed ? t('auth.logOut.failed') : null}
      cancelLabel={t('auth.logOut.stay')}
      confirmLabel={t(pending ? 'auth.logOut.pending' : 'auth.logOut.confirm')}
      onCancel={onCancel}
      onConfirm={onConfirm}
      pending={pending}
    />
  );
}
