import { LegalPage } from './LegalPage';

/** Privacy Policy: public, subject-mandatory, static content with no API behind it. */
export function PrivacyPage() {
  return <LegalPage document="privacy" />;
}
