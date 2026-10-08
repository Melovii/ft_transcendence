import { Outlet } from 'react-router-dom';

import { ConnectionOverlay } from '@features/room/components/ConnectionOverlay';

import { Footer } from './Footer';

/**
 * Room and Game shell — one layout, because Room Waiting, Countdown, In-Game and the
 * Results state are all states of the same room route, not separate routes. Each screen
 * draws its own full-width composition above the legal footer.
 */
export function GameLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Outlet />
      <ConnectionOverlay />
      <Footer />
    </div>
  );
}
