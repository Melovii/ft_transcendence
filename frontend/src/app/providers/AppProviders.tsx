import type { ReactNode } from 'react';

import { SessionBootstrap } from '@app/bootstrap/SessionBootstrap';

/**
 * Application-wide providers.
 *
 * Order matters: session bootstrap resolves before the router renders, so route guards
 * never redirect on a session that is merely still `UNKNOWN`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <SessionBootstrap>{children}</SessionBootstrap>;
}
