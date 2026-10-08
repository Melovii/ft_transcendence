import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@shared/ui';
import type { IconName } from '@shared/ui';
import { cn } from '@shared/utils';

import * as styles from './AuthDialog.styles';

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  value: string;
  /** Translated message under the field. The field paints its error state while it is set. */
  error?: string | undefined;
  /** Paints the confirmed state, once the server has accepted the value. */
  confirmed?: boolean;
  leadingIcon?: IconName;
  /** Renders the value hidden, with the show / hide control. */
  password?: boolean;
  /** Content between the control and the next field, such as the form's alert. */
  children?: ReactNode;
}

/**
 * One labelled field of the dialog. The message under it is tied to the control with
 * `aria-describedby`, and an error also sets `aria-invalid` and is announced, so the
 * failure is read out with the field it belongs to.
 */
export function AuthField({
  label,
  value,
  error,
  confirmed = false,
  leadingIcon,
  password = false,
  children,
  className,
  type,
  ...props
}: AuthFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const messageId = `${id}-message`;
  const [visible, setVisible] = useState(false);
  const hidden = password && !visible;
  const status = error ? 'error' : confirmed ? 'success' : 'default';

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      <div className="relative flex items-center">
        {leadingIcon && <Icon name={leadingIcon} className={styles.leadingIcon} />}

        <input
          id={id}
          value={value}
          type={password ? (hidden ? 'password' : 'text') : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          className={cn(
            styles.controlBase,
            styles.controlStatus[status],
            leadingIcon ? styles.controlLeading : styles.controlPlain,
            password && styles.controlTrailing,
            hidden && value ? styles.masked : styles.controlText,
            className,
          )}
          {...props}
        />

        {password && (
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={t(visible ? 'auth.fields.hidePassword' : 'auth.fields.showPassword')}
            aria-pressed={visible}
            aria-controls={id}
            className={styles.visibilityToggle}
          >
            <Icon name={visible ? 'password' : 'passwordHidden'} />
          </button>
        )}
      </div>

      {error && (
        <p id={messageId} role="alert" className={styles.message}>
          <span className={styles.messageBadge}>
            <Icon name="warning" />
          </span>
          {error}
        </p>
      )}

      {children}
    </div>
  );
}
