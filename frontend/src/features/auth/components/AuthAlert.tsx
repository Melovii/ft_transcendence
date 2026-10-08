import { useTranslation } from 'react-i18next';

import { cn } from '@shared/utils';

import type { AuthAlert as AuthAlertContent } from '../model/feedback';
import * as styles from './AuthDialog.styles';

/**
 * The form's result banner: a failed request in coral, a successful Log In in green. An
 * error is announced assertively; the welcome is polite.
 */
export function AuthAlert({
  alert,
  values,
  className,
}: {
  alert: AuthAlertContent;
  /** Interpolation values for the title and body, such as the username. */
  values?: Record<string, string> | undefined;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role={alert.tone === 'error' ? 'alert' : 'status'}
      className={cn(styles.alertBase, styles.alertTone[alert.tone], className)}
    >
      <p className={styles.alertTitle}>{t(alert.title, values ?? {})}</p>
      <p className={styles.alertBody}>{t(alert.body, values ?? {})}</p>
    </div>
  );
}
