import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import alienAvatar from '@assets/avatars/alien-avatar.svg';
import aviatorFoxAvatar from '@assets/avatars/aviator-fox-avatar.svg';
import brainRobotAvatar from '@assets/avatars/brain-robot-avatar.svg';
import glassesBoyAvatar from '@assets/avatars/glasses-boy-avatar.svg';
import headphonesGirlAvatar from '@assets/avatars/headphones-girl-avatar.svg';
import punkAvatar from '@assets/avatars/punk-avatar.svg';
import scholarOwlAvatar from '@assets/avatars/scholar-owl-avatar.svg';
import dividerArtwork from '@assets/landing/landing-divider.svg';
import edgeLeftArtwork from '@assets/landing/landing-edge-left.svg';
import edgeRightArtwork from '@assets/landing/landing-edge-right.svg';
import heroArtwork from '@assets/landing/landing-hero.svg';
import beatOtherTeamArtwork from '@assets/landing/landing-step-beat-the-other-team.svg';
import giveClueArtwork from '@assets/landing/landing-step-give-a-clue.svg';
import guessTogetherArtwork from '@assets/landing/landing-step-guess-together.svg';
import { AuthDialog } from '@features/auth/components/AuthDialog';
import type { AuthMode } from '@features/auth/components/AuthDialog.types';
import { SESSION_EXPIRED_NOTICE, oauthFailure } from '@features/auth/model/feedback';
import { ROUTES } from '@shared/constants';
import { LanguageSelector } from '@shared/i18n/LanguageSelector';
import { useSessionStore } from '@shared/stores';
import { Button, Icon, Toast, ToastStack } from '@shared/ui';
import type { IconName } from '@shared/ui';
import { cn } from '@shared/utils';

import * as styles from './LandingPage.styles';

const HOW_TO_PLAY_ID = 'how-to-play';

interface Step {
  key: 'giveClue' | 'guessTogether' | 'beatOtherTeam';
  icon: IconName;
  /** Icon tile color on mobile and tablet. */
  tile: string;
  artwork: string;
  artworkHeight: number;
  /** Card position on the desktop stage. */
  position: string;
}

const STEPS: Step[] = [
  {
    key: 'giveClue',
    icon: 'hint',
    tile: 'bg-accent-yellow-deep',
    artwork: giveClueArtwork,
    artworkHeight: 117,
    position: 'desktop:left-[416px]',
  },
  {
    key: 'guessTogether',
    icon: 'team',
    tile: 'bg-primary',
    artwork: guessTogetherArtwork,
    artworkHeight: 117,
    position: 'desktop:left-[783px]',
  },
  {
    key: 'beatOtherTeam',
    icon: 'trophy',
    tile: 'bg-secondary-deep',
    artwork: beatOtherTeamArtwork,
    artworkHeight: 120,
    position: 'desktop:left-[1153px]',
  },
];

/** Community artwork: avatar pictures and online dots, in the design's paint order. */
const COMMUNITY_AVATARS = [
  { src: scholarOwlAvatar, position: 'top-0 left-[20px]' },
  { src: alienAvatar, position: 'top-0 left-[77px]' },
  { dot: 'top-[32px] left-[109px]' },
  { src: punkAvatar, position: 'top-0 left-[134px]' },
  { dot: 'top-[32px] left-[166px]' },
  { src: brainRobotAvatar, position: 'top-[46px] left-0' },
  { dot: 'top-[78px] left-[32px]' },
  { src: aviatorFoxAvatar, position: 'top-[46px] left-[52px]' },
  { dot: 'top-[78px] left-[84px]' },
  { src: headphonesGirlAvatar, position: 'top-[46px] left-[104px]' },
  { dot: 'top-[78px] left-[136px]' },
  { src: glassesBoyAvatar, position: 'top-[46px] left-[156px]' },
  { dot: 'top-[78px] left-[188px]' },
  { dot: 'top-[33px] left-[52px]' },
];

/**
 * Landing screen: the entry point that introduces the game and leads into Log In.
 *
 * Every call to action opens the Log In dialog over this page, which stays mounted and
 * visible underneath; an authenticated visitor goes straight on to the Lobby instead.
 * `/login` and `/register` render this page with the dialog already open, and closing
 * the dialog there leaves the address at `/`. A session that expired opens Log In with a
 * notice saying so. Learn More and Help bring the How To Play
 * section into view.
 */
export function LandingPage({ authMode: linkedAuthMode }: { authMode?: AuthMode }) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const authenticated = useSessionStore((state) => state.status === 'AUTHENTICATED');
  const accountDeleted = useSessionStore((state) => state.accountDeleted);
  const sessionExpired = useSessionStore((state) => state.sessionExpired);
  const [searchParams, setSearchParams] = useSearchParams();
  // A Google sign-in that failed or was cancelled comes back as `?oauth_error=<code>`.
  const [oauthNotice] = useState(() => oauthFailure(searchParams.get('oauth_error')));
  const [authMode, setAuthMode] = useState<AuthMode | null>(
    linkedAuthMode ?? (oauthNotice ? 'login' : null),
  );

  // The code is read once; it leaves the address bar so a reload does not repeat it.
  useEffect(() => {
    if (!searchParams.has('oauth_error')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('oauth_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Links from other screens, such as How to Play on the legal pages, arrive with a hash.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const openAuth = (mode: AuthMode) => {
    if (authenticated) navigate(ROUTES.lobby);
    else setAuthMode(mode);
  };

  const closeAuth = useCallback(() => {
    setAuthMode(null);
    useSessionStore.getState().acknowledgeSessionExpired();
    if (linkedAuthMode) navigate(ROUTES.landing, { replace: true });
  }, [linkedAuthMode, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        <header>
          <nav aria-label={t('landing.primaryNavigation')} className={styles.header}>
            <Button
              theme="outline"
              sizeClassName={styles.logIn}
              onClick={() => openAuth('login')}
              className="shrink-0"
            >
              {t('landing.logIn')}
            </Button>
            <button type="button" onClick={() => openAuth('login')} className={styles.topPlayNow}>
              {t('landing.playNow')}
            </button>
          </nav>
        </header>

        <main className={styles.stack}>
          <section aria-labelledby="landing-title" className={styles.stack}>
            <img
              src={heroArtwork}
              alt=""
              width={706}
              height={455}
              className={styles.heroIllustration}
            />
            <div className={styles.heroCopy}>
              <p className={styles.badge}>{t('landing.badge')}</p>
              <h1 id="landing-title" className={styles.headline}>
                <span className={styles.headlinePart}>{t('landing.headlineLead')}</span>{' '}
                <span className={styles.headlinePart}>{t('landing.headlineTail')}</span>
                <span className={styles.tagline}>{t('landing.tagline')}</span>
              </h1>
              <p className={styles.descriptionShort}>{t('landing.descriptionShort')}</p>
              <p className={styles.description}>{t('landing.description')}</p>
              <Button
                sizeClassName={styles.heroPlayNow}
                onClick={() => openAuth('login')}
                className={styles.heroPlayNowPlacement}
              >
                {t('landing.playNow')}
              </Button>
              <a href={`#${HOW_TO_PLAY_ID}`} className={styles.learnMore}>
                {t('landing.learnMore')}
              </a>
            </div>
          </section>

          <section
            id={HOW_TO_PLAY_ID}
            aria-labelledby="how-to-play-title"
            className={styles.howToPlay}
          >
            <h2 id="how-to-play-title" className={styles.howToPlayTitle}>
              {t('landing.howToPlay')}
            </h2>
            <img src={dividerArtwork} alt="" className={cn(styles.divider, 'desktop:left-103.5')} />
            <img src={dividerArtwork} alt="" className={cn(styles.divider, 'desktop:left-268.5')} />
            <ol className={styles.stack}>
              {STEPS.map((step) => (
                <li key={step.key} className={cn(styles.step, step.position)}>
                  <span className={cn(styles.stepTile, step.tile)}>
                    <Icon name={step.icon} />
                  </span>
                  <img
                    src={step.artwork}
                    alt=""
                    width={224}
                    height={step.artworkHeight}
                    className={styles.stepIllustration}
                  />
                  <div className={styles.stepCopy}>
                    <h3 className={styles.stepTitle}>{t(`landing.${step.key}Title`)}</h3>
                    <p className={styles.stepDescription}>{t(`landing.${step.key}Description`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="landing-community" className="hidden desktop:block">
            <div aria-hidden="true" className={styles.communityArtwork}>
              {COMMUNITY_AVATARS.map((item, index) =>
                item.src ? (
                  <img
                    key={index}
                    src={item.src}
                    alt=""
                    className={cn(styles.communityAvatar, item.position)}
                  />
                ) : (
                  <span key={index} className={cn(styles.onlineDot, item.dot)} />
                ),
              )}
            </div>
            <p id="landing-community" className={styles.communityMessage}>
              {t('landing.community')}
            </p>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className={styles.inviteFriends}
            >
              <Icon name="userAdd" className="text-[23px]" />
              {t('landing.inviteFriends')}
            </button>
          </section>
        </main>

        <footer className={styles.footer}>
          <nav aria-label={t('landing.legalNavigation')} className={styles.footerLinks}>
            <Link to={ROUTES.privacy} className={styles.footerLink}>
              {t('landing.privacy')}
            </Link>
            <span aria-hidden="true" className="whitespace-pre">
              {'   •   '}
            </span>
            <Link to={ROUTES.terms} className={styles.footerLink}>
              {t('landing.terms')}
            </Link>
            <span aria-hidden="true" className="whitespace-pre">
              {'   •   '}
            </span>
            <a href={`#${HOW_TO_PLAY_ID}`} className={styles.footerLink}>
              {t('landing.help')}
            </a>
          </nav>
          <LanguageSelector size="sm" className={styles.language} />
          <p className={styles.copyright}>{t('landing.copyright')}</p>
        </footer>
      </div>

      <img src={edgeLeftArtwork} alt="" className={styles.edgeLeft} />
      <img src={edgeRightArtwork} alt="" className={styles.edgeRight} />

      {authMode && (
        <AuthDialog
          initialMode={authMode}
          onClose={closeAuth}
          notice={oauthNotice ?? (sessionExpired ? SESSION_EXPIRED_NOTICE : null)}
        />
      )}
      {accountDeleted && (
        <ToastStack>
          <Toast
            tone="success"
            icon="check"
            onDismiss={() => useSessionStore.getState().acknowledgeAccountDeleted()}
            dismissLabel={t('common.dismiss')}
          >
            {t('landing.accountDeleted')}
          </Toast>
        </ToastStack>
      )}
    </div>
  );
}
