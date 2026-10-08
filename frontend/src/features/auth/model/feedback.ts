/**
 * What the Log In and Register forms show for a failed request.
 *
 * A rejected field value goes back under its own field; everything else becomes the
 * form's alert. Only translation keys come out of here — the server's own `message` is
 * never shown, so no request detail reaches the screen.
 */

import { ApiError } from '@shared/api';

import type { RegisterField } from './validation';

export interface AuthAlert {
  tone: 'error' | 'success';
  title: string;
  body: string;
}

export type AuthFailure = { field: RegisterField; message: string } | { alert: AuthAlert };

const FIELD_ERRORS: Record<string, { field: RegisterField; message: string }> = {
  INVALID_EMAIL: { field: 'email', message: 'auth.validation.emailInvalid' },
  INVALID_USERNAME: { field: 'username', message: 'auth.validation.usernameInvalid' },
  INVALID_PASSWORD: { field: 'password', message: 'auth.validation.passwordInvalid' },
  EMAIL_TAKEN: { field: 'email', message: 'auth.feedback.emailTaken' },
  USERNAME_TAKEN: { field: 'username', message: 'auth.feedback.usernameTaken' },
};

const alert = (key: string): AuthFailure => ({
  alert: { tone: 'error', title: `auth.feedback.${key}Title`, body: `auth.feedback.${key}Body` },
});

/**
 * Shown on Log In when a signed-in session was lost because the server would not renew it
 * (`401 SESSION_EXPIRED`, or a `401` that survived a failed refresh).
 */
export const SESSION_EXPIRED_NOTICE: AuthAlert = {
  tone: 'error',
  title: 'auth.feedback.sessionExpiredTitle',
  body: 'auth.feedback.sessionExpiredBody',
};

/** The `oauth_error` codes the Google callback redirects back with. */
const OAUTH_ERRORS = [
  'OAUTH_CANCELLED',
  'OAUTH_STATE_INVALID',
  'OAUTH_EMAIL_UNVERIFIED',
  'OAUTH_PROVIDER_ERROR',
] as const;

/**
 * The alert for a Google sign-in that came back with `?oauth_error=<code>`, or `null`
 * without one. An unknown code reads as a provider failure.
 */
export function oauthFailure(code: string | null): AuthAlert | null {
  if (!code) return null;
  const known = OAUTH_ERRORS.find((value) => value === code) ?? 'OAUTH_PROVIDER_ERROR';
  return {
    tone: 'error',
    title: `auth.oauth.error.${known}.title`,
    body: `auth.oauth.error.${known}.body`,
  };
}

export function authFailure(error: unknown): AuthFailure {
  if (!(error instanceof ApiError)) return alert('unavailable');

  const fieldError = FIELD_ERRORS[error.code];
  if (fieldError) return fieldError;

  switch (error.code) {
    // Returned alike for an unknown email and a wrong password, and shown alike.
    case 'INVALID_CREDENTIALS':
      return alert('credentials');
    case 'RATE_LIMITED':
      return alert('rateLimited');
    default:
      return alert('unavailable');
  }
}
