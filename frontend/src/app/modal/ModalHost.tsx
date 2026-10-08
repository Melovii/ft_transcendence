import { useModalStore } from '@shared/stores';

import { ProfilePopup } from './ProfilePopup';
import { SettingsPopup } from './SettingsPopup';

/**
 * App-level modal host.
 *
 * Mounted once, outside every feature. Any feature opens a modal by publishing an
 * intent to the modal store (`openProfileModal(userId)`, `openSettingsModal()`), so Lobby,
 * Room and Game can open a profile or Settings without importing `features/profile`.
 */
export function ModalHost() {
  const active = useModalStore((state) => state.active);
  const close = useModalStore((state) => state.close);

  if (!active) return null;

  switch (active.kind) {
    case 'profile':
      // Keyed by user, so opening another profile starts from its own loading state.
      return <ProfilePopup key={active.userId} userId={active.userId} onClose={close} />;
    case 'settings':
      return <SettingsPopup onClose={close} />;
    default:
      return null;
  }
}
