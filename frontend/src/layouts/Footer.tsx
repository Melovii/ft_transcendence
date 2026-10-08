import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ROUTES } from '@shared/constants';

/**
 * Footer present on every layout, public and authenticated.
 *
 * The Privacy and Terms links are subject-mandatory; their absence is a rejection
 * risk, so the footer is part of the layout foundation rather than a page detail.
 */
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-auto px-3 py-4">
      <nav
        aria-label={t('legal.legalNavigation')}
        className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-4 gap-y-1 text-sm"
      >
        <Link to={ROUTES.privacy}>{t('legal.privacyPolicy')}</Link>
        <Link to={ROUTES.terms}>{t('legal.termsOfService')}</Link>
      </nav>
    </footer>
  );
}
