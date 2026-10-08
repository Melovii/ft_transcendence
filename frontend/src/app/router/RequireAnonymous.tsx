import { Navigate, Outlet } from 'react-router-dom';

import { ROUTES } from '@shared/constants';
import { useSessionStore } from '@shared/stores';

/** Keeps an authenticated user out of Login/Register. */
export function RequireAnonymous() {
  const status = useSessionStore((state) => state.status);

  if (status === 'AUTHENTICATED') {
    return <Navigate to={ROUTES.lobby} replace />;
  }

  return <Outlet />;
}
