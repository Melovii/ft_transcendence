/**
 * Log In and Register field rules, as `01 - Identity/` defines them. The server enforces
 * every one of them; checking them here only saves the round trip for input that could
 * never succeed.
 *
 * A failed rule is reported as the translation key of its message.
 */

import { USERNAME_PATTERN } from '@shared/types';
import type { LoginRequest, RegisterRequest } from '@shared/types';

/** Email: something, an `@`, a domain with a dot, and no whitespace. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password: at least 8 characters and at most 72 bytes, the hashing input limit. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export type LoginField = keyof LoginRequest;
export type RegisterField = keyof RegisterRequest | 'confirmPassword';

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export interface RegisterValues extends RegisterRequest {
  confirmPassword: string;
}

function emailError(email: string): string | undefined {
  if (!email) return 'auth.validation.emailRequired';
  if (!EMAIL_PATTERN.test(email)) return 'auth.validation.emailInvalid';
  return undefined;
}

function passwordLengthError(password: string): string | undefined {
  if (!password) return 'auth.validation.passwordRequired';
  if (password.length < PASSWORD_MIN_LENGTH) return 'auth.validation.passwordTooShort';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'auth.validation.passwordTooLong';
  }
  return undefined;
}

/** Drops the rules that passed, so an empty object means the form may be sent. */
function compact<Field extends string>(errors: Record<Field, string | undefined>) {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors<Field>;
}

/** Log In only needs a well-formed email and a password: the stored hash decides the rest. */
export function validateLogin({ email, password }: LoginRequest): FieldErrors<LoginField> {
  return compact<LoginField>({
    email: emailError(email),
    password: password ? undefined : 'auth.validation.passwordRequired',
  });
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterField> {
  const { username, email, password, confirmPassword } = values;

  let confirmError: string | undefined;
  if (!confirmPassword) confirmError = 'auth.validation.confirmPasswordRequired';
  else if (confirmPassword !== password) confirmError = 'auth.validation.passwordMismatch';

  return compact<RegisterField>({
    username: !username
      ? 'auth.validation.usernameRequired'
      : USERNAME_PATTERN.test(username)
        ? undefined
        : 'auth.validation.usernameInvalid',
    email: emailError(email),
    password: passwordLengthError(password),
    confirmPassword: confirmError,
  });
}
