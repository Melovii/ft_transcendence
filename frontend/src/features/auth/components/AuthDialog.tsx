import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import alienArtwork from '@assets/auth/auth-alien.svg';
import cardsArtwork from '@assets/auth/auth-cards.svg';
import foxCornerArtwork from '@assets/auth/auth-fox-corner.svg';
import foxPeekArtwork from '@assets/auth/auth-fox-peek.svg';
import mascotArtwork from '@assets/auth/auth-mascot.svg';
import { Button, Dialog } from '@shared/ui';
import { cn } from '@shared/utils';

import type { AuthAlert as AuthAlertContent } from '../model/feedback';
import { AuthAlert } from './AuthAlert';
import * as styles from './AuthDialog.styles';
import type { AuthMode } from './AuthDialog.types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

const MODES: AuthMode[] = ['login', 'register'];

export interface AuthDialogProps {
  /** The form the dialog opens on. */
  initialMode: AuthMode;
  /** Closes the dialog; the page underneath stays where it was. */
  onClose: () => void;
  /** Why the dialog opened by itself, such as a Google sign-in that failed. */
  notice?: AuthAlertContent | null;
}

/**
 * The Log In / Sign Up dialog, opened over the Landing page.
 *
 * One dialog holds both forms behind the Log In / Register tabs; switching keeps the
 * dialog open and starts the other form empty. Nothing here changes the route: only a
 * successful Log In or Sign Up moves on, to the Lobby. Continue with Google sits under both
 * forms and leaves for Google instead. The shared `Dialog` shell supplies
 * the backdrop, close button and keyboard contract; this component draws the surface and
 * the design's artwork.
 */
export function AuthDialog({ initialMode, onClose, notice = null }: AuthDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const formRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({});
  const focusFieldAfterSwitch = useRef(false);
  const id = useId();
  const other: AuthMode = mode === 'login' ? 'register' : 'login';

  // The trap lands on the first control, the close button; the form's first field is
  // where the user starts, so focus moves on to it.
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  useEffect(() => {
    if (!focusFieldAfterSwitch.current) return;
    focusFieldAfterSwitch.current = false;
    formRef.current?.querySelector('input')?.focus();
  }, [mode]);

  /** The prompt and the large button hand over to the other form's first field. */
  const switchTo = (next: AuthMode) => {
    focusFieldAfterSwitch.current = true;
    setMode(next);
  };

  // Arrow keys move between the two tabs, as a tab list does.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = MODES.indexOf(mode);
    let next: AuthMode | undefined;
    if (event.key === 'ArrowRight') next = MODES[(index + 1) % MODES.length];
    else if (event.key === 'ArrowLeft') next = MODES[(index + MODES.length - 1) % MODES.length];
    else if (event.key === 'Home') next = MODES[0];
    else if (event.key === 'End') next = MODES[MODES.length - 1];
    if (!next) return;
    event.preventDefault();
    setMode(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-subtitle`}
      closeLabel={t('auth.close')}
      onClose={onClose}
      className={styles.dialog}
    >
      <h2 id={`${id}-title`} className={styles.title}>
        {t(`auth.${mode}.title`)}
      </h2>
      <p id={`${id}-subtitle`} className={styles.subtitle}>
        {t(`auth.${mode}.subtitle`)}
      </p>

      <div ref={formRef} className={styles.card}>
        {notice && <AuthAlert alert={notice} className={styles.notice} />}
        <div role="tablist" aria-label={t('auth.modes')} className={styles.tabs}>
          <span
            aria-hidden="true"
            className={cn(styles.tabIndicatorBase, styles.tabIndicator[mode])}
          />
          {MODES.map((tabMode) => (
            <button
              key={tabMode}
              ref={(element) => {
                tabRefs.current[tabMode] = element;
              }}
              id={`${id}-tab-${tabMode}`}
              type="button"
              role="tab"
              aria-selected={tabMode === mode}
              aria-controls={`${id}-panel`}
              tabIndex={tabMode === mode ? 0 : -1}
              onClick={() => setMode(tabMode)}
              onKeyDown={onTabKeyDown}
              className={styles.tab}
            >
              {t(`auth.${tabMode}.tab`)}
            </button>
          ))}
        </div>

        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${mode}`}>
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
        <GoogleSignInButton />
      </div>

      <p className={styles.prompt}>
        {t(`auth.${mode}.switchPrompt`)}{' '}
        <button type="button" onClick={() => switchTo(other)} className={styles.promptAction}>
          {t(`auth.${mode}.switchAction`)}
        </button>
      </p>
      <Button
        sizeClassName={styles.submit}
        onClick={() => switchTo(other)}
        className={cn(styles.switchButtonBase, styles.switchButton[mode])}
      >
        {t(`auth.${mode}.switchAction`)}
      </Button>

      <img src={mascotArtwork} alt="" className={styles.mascot} />
      <img src={cardsArtwork} alt="" className={styles.cards} />
      <img src={foxPeekArtwork} alt="" className={styles.foxPeek} />
      <img src={alienArtwork} alt="" className={styles.alien} />
      <img src={foxCornerArtwork} alt="" className={styles.foxCorner} />
    </Dialog>
  );
}
