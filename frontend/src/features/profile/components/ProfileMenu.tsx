import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { openProfileModal, openSettingsModal, useSessionStore } from '@shared/stores';
import { AvatarImage, Icon } from '@shared/ui';
import type { IconName } from '@shared/ui';
import { cn } from '@shared/utils';

import { useOwnProfile } from '../hooks/useOwnProfile';
import * as styles from './ProfileMenu.styles';

/**
 * The signed-in player's summary: avatar, name, presence and level. It opens a small menu
 * with the player's own Profile and their Settings, each a pop-up over the page.
 *
 * `card` is the Room Discovery header: mobile and tablet show the avatar and the name at
 * the head of the page; the desktop layout shows the full card in the top-right corner.
 * `plain` is the top of the Ready Room sidebar: avatar, name and presence, without a card.
 * `game` is the Game Board header: avatar, name, the player's role badge and the chevron
 * on the desktop board, and the avatar beside the role badge on phones and tablets.
 */
export function ProfileMenu({
  variant = 'card',
  badge,
  className,
}: {
  variant?: 'card' | 'plain' | 'game';
  /** The `game` variant's role badge, such as SPYMASTER. */
  badge?: string | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.user);
  const { profile, status } = useOwnProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const userId = profile?.user_id ?? session?.user_id;
  const username = profile?.username ?? session?.username ?? '';
  const avatarUrl = profile?.avatar_url;
  const label = t('lobby.profile.menu.label', { username });

  const avatar = (imageClass: string, placeholderClass: string) => (
    <AvatarImage src={avatarUrl} className={imageClass} placeholderClassName={placeholderClass} />
  );

  const trigger = (triggerClass: string, content: ReactNode) => (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setMenuOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        aria-label={label}
        className={cn(triggerClass, className)}
      >
        {content}
      </button>
      {menuOpen && (
        <AccountMenu
          id={menuId}
          label={label}
          triggerRef={triggerRef}
          onClose={closeMenu}
          items={[
            {
              icon: 'profile',
              label: t('lobby.profile.menu.profile'),
              select: () => {
                if (userId !== undefined) openProfileModal(userId);
              },
            },
            {
              icon: 'settings',
              label: t('lobby.profile.menu.settings'),
              select: openSettingsModal,
            },
          ]}
        />
      )}
    </>
  );

  if (variant === 'game') {
    return trigger(
      styles.game.menu,
      <>
        <span className={styles.game.avatar}>
          {avatar(styles.avatarImage, styles.game.avatarPlaceholder)}
        </span>
        <span className={styles.game.details}>
          <span className={styles.game.name}>{username}</span>
          {badge && <span className={styles.game.badge}>{badge}</span>}
        </span>
        <span aria-hidden="true" className={styles.game.chevron}>
          <Icon name="chevronDown" />
        </span>
      </>,
    );
  }

  if (variant === 'plain') {
    return trigger(
      styles.plain.menu,
      <>
        <span className={styles.plain.avatar}>
          {avatar(styles.avatarImage, styles.plain.avatarPlaceholder)}
        </span>
        <span className={styles.plain.details}>
          <span className={styles.plain.name}>{username}</span>
          <span className={styles.plain.status}>
            <span aria-hidden="true" className={styles.plain.statusDot} />
            {t('lobby.profile.online')}
          </span>
        </span>
      </>,
    );
  }

  return trigger(
    styles.menu,
    <>
      <span className={styles.avatarFrame}>
        <span className={styles.avatar}>
          {avatar(styles.avatarImage, styles.avatarPlaceholder)}
        </span>
        <span aria-hidden="true" className={styles.onlineDot} />
      </span>

      <span className={styles.details}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{username}</span>
          <span className={styles.badge}>
            <span aria-hidden="true" className={styles.badgeDot} />
            {t('lobby.profile.online')}
          </span>
        </span>
        {status === 'READY' && profile ? (
          <span className={styles.level}>{t('lobby.profile.level', { level: profile.level })}</span>
        ) : (
          status === 'LOADING' && <span aria-hidden="true" className={styles.levelSkeleton} />
        )}
      </span>

      <span aria-hidden="true" className={styles.chevron}>
        <Icon name="chevronDown" />
      </span>
    </>,
  );
}

interface MenuItem {
  icon: IconName;
  label: string;
  select: () => void;
}

/**
 * The account menu, just below the summary that opened it. It follows the menu button
 * pattern: focus moves to the first item, the arrow keys, Home and End move between
 * items, Enter chooses one, and Escape closes the menu and returns focus to the summary.
 * A press outside, Tab, a scroll or a resize closes it too. It is drawn in a portal so no
 * layout around the summary can clip it.
 */
function AccountMenu({
  id,
  label,
  triggerRef,
  items,
  onClose,
}: {
  id: string;
  label: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  items: MenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? 0;
    if (!anchor) return;
    const gutter = 8;
    // Right-aligned with the summary, and kept inside the viewport.
    const left = Math.max(
      gutter,
      Math.min(anchor.right - width, window.innerWidth - width - gutter),
    );
    setPosition({ top: anchor.bottom + gutter, left });
  }, [triggerRef]);

  useEffect(() => {
    if (!position) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  }, [position]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const dismiss = () => onClose();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [onClose, triggerRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) =>
      entries[(next + entries.length) % entries.length]?.focus({ preventScroll: true });
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(entries.length - 1);
        break;
      case 'Escape':
        onClose();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        onClose();
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
      className={styles.dropdown}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            // The pop-up it opens returns focus to the summary when it closes.
            triggerRef.current?.focus({ preventScroll: true });
            onClose();
            item.select();
          }}
          className={styles.dropdownItem}
        >
          <Icon name={item.icon} className={styles.dropdownIcon} />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
