import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@shared/utils';

import { useAuthentication } from '../hooks/useAuthentication';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { authFailure } from '../model/feedback';
import type { AuthAlert as AuthAlertContent } from '../model/feedback';
import { validateLogin } from '../model/validation';
import type { FieldErrors, LoginField } from '../model/validation';
import { AuthAlert } from './AuthAlert';
import * as styles from './AuthDialog.styles';
import { AuthField } from './AuthField';
import { Button } from '@shared/ui';

/** How long the welcome banner stays up before the Lobby opens. */
const WELCOME_DURATION_MS = 900;

const WELCOME: AuthAlertContent = {
  tone: 'success',
  title: 'auth.feedback.welcomeTitle',
  body: 'auth.feedback.welcomeBody',
};

/**
 * Log In: email and password. A failed attempt keeps both values and explains itself in
 * the alert under the email field; a successful one greets the player there before the
 * Lobby opens.
 */
export function LoginForm() {
  const { t } = useTranslation();
  const { logIn, enter } = useAuthentication();
  const { formRef, submitting, run } = useSubmitGuard();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [alert, setAlert] = useState<AuthAlertContent | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const edit = (field: LoginField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setAlert(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const credentials = { email: values.email.trim(), password: values.password };

    run(validateLogin(credentials), setErrors, async () => {
      setAlert(null);
      try {
        const { username: name, session } = await logIn(credentials);
        setUsername(name);
        setAlert(WELCOME);
        await new Promise((resolve) => setTimeout(resolve, WELCOME_DURATION_MS));
        enter(session);
        return true;
      } catch (error) {
        const failure = authFailure(error);
        if ('alert' in failure) setAlert(failure.alert);
        else if (failure.field === 'email' || failure.field === 'password') {
          setErrors({ [failure.field]: failure.message });
        }
        return false;
      }
    });
  };

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <div className={cn(styles.fieldsBase, styles.fields.login)}>
        <AuthField
          label={t('auth.fields.email')}
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.fields.emailPlaceholder')}
          leadingIcon="email"
          value={values.email}
          onChange={(event) => edit('email', event.target.value)}
          error={errors.email && t(errors.email)}
          confirmed={username !== null}
        >
          {alert && <AuthAlert alert={alert} values={username ? { username } : undefined} />}
        </AuthField>

        <AuthField
          label={t('auth.fields.password')}
          password
          name="password"
          autoComplete="current-password"
          placeholder={t('auth.fields.passwordPlaceholder')}
          value={values.password}
          onChange={(event) => edit('password', event.target.value)}
          error={errors.password && t(errors.password)}
        />
      </div>

      <Button
        type="submit"
        loading={submitting}
        sizeClassName={styles.submit}
        block
        className={styles.submitPlacement.login}
      >
        {t('auth.login.submit')}
      </Button>
    </form>
  );
}
