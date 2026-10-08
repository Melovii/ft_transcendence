import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@shared/utils';

import type { EntryAlert as EntryAlertContent } from '../model/entry';
import * as styles from './RoomEntryDialog.styles';

/**
 * The Create Room and Join Room result banner: a failure in coral, a success in green. A
 * failure is announced assertively, a success politely.
 */
export function EntryAlert({
  alert,
  action,
  className,
}: {
  alert: EntryAlertContent;
  /** A follow-up control under the text, such as returning to the user's room. */
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role={alert.tone === 'error' ? 'alert' : 'status'}
      className={cn(styles.alertBase, styles.alertTone[alert.tone], className)}
    >
      <p className={styles.alertTitle}>{t(alert.title)}</p>
      <p className={styles.alertBody}>{t(alert.body)}</p>
      {action}
    </div>
  );
}
