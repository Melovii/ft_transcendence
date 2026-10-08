import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@shared/utils';

import { useAuthentication } from '../hooks/useAuthentication';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { authFailure } from '../model/feedback';
import type { AuthAlert as AuthAlertContent } from '../model/feedback';
import { validateRegister } from '../model/validation';
import type { FieldErrors, RegisterField, RegisterValues } from '../model/validation';
import { AuthAlert } from './AuthAlert';
import * as styles from './AuthDialog.styles';
import { AuthField } from './AuthField';
import { Button } from '@shared/ui';

const EMPTY: RegisterValues = { username: '', email: '', password: '', confirmPassword: '' };

/**
 * Register: username, email, password and its confirmation, the fields the Register
 * contract takes plus the design's repeat check. A value the server turns down — a taken
 * email or username — comes back under its own field; the account is created and the
 * Lobby opens in one step.
 */
export function RegisterForm() {
  const { t } = useTranslation();
  const { register, enter } = useAuthentication();
  const { formRef, submitting, run } = useSubmitGuard();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const [alert, setAlert] = useState<AuthAlertContent | null>(null);

  const edit = (field: RegisterField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setAlert(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = {
      ...values,
      username: values.username.trim(),
      email: values.email.trim(),
    };

    run(validateRegister(account), setErrors, async () => {
      setAlert(null);
      try {
        const { session } = await register({
          email: account.email,
          username: account.username,
          password: account.password,
        });
        enter(session);
        return true;
      } catch (error) {
        const failure = authFailure(error);
        if ('alert' in failure) setAlert(failure.alert);
        else setErrors({ [failure.field]: failure.message });
        return false;
      }
    });
  };

  const fieldProps = (field: RegisterField) => ({
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) => edit(field, event.target.value),
    error: errors[field] && t(errors[field]),
  });

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <div className={cn(styles.fieldsBase, styles.fields.register)}>
        <AuthField
          {...fieldProps('username')}
          label={t('auth.fields.username')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.fields.usernamePlaceholder')}
          leadingIcon="profile"
        />
        <AuthField
          {...fieldProps('email')}
          label={t('auth.fields.email')}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.fields.emailPlaceholder')}
          leadingIcon="email"
        />
        <AuthField
          {...fieldProps('password')}
          label={t('auth.fields.password')}
          password
          autoComplete="new-password"
          placeholder={t('auth.fields.newPasswordPlaceholder')}
        />
        <AuthField
          {...fieldProps('confirmPassword')}
          label={t('auth.fields.confirmPassword')}
          password
          autoComplete="new-password"
          placeholder={t('auth.fields.confirmPasswordPlaceholder')}
        />
        {alert && <AuthAlert alert={alert} />}
      </div>

      <Button
        type="submit"
        loading={submitting}
        sizeClassName={styles.submit}
        block
        className={styles.submitPlacement.register}
      >
        {t('auth.register.submit')}
      </Button>
    </form>
  );
}
