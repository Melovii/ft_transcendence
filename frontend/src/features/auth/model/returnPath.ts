/**
 * Where a successful sign-in lands.
 *
 * An anonymous visit to an authenticated route is sent to Log In with the route it asked
 * for (`state.from`, set by `RequireAuth`). Signing in returns there; route recovery then
 * holds it to the account's room membership, so a room the user no longer belongs to
 * still ends on the Lobby. Only a same-origin path is accepted, never `//host` or a URL.
 */

import { ROUTES } from '@shared/constants';

const MAX_RETURN_PATH_LENGTH = 200;

export function returnPath(locationState: unknown): string {
  const from =
    typeof locationState === 'object' && locationState !== null
      ? (locationState as { from?: unknown }).from
      : undefined;
  if (
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    from.length <= MAX_RETURN_PATH_LENGTH
  ) {
    return from;
  }
  return ROUTES.lobby;
}
