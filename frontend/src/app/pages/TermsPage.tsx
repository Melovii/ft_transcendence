import { LegalPage } from './LegalPage';

/** Terms of Service: public, subject-mandatory, static content with no API behind it. */
export function TermsPage() {
  return <LegalPage document="terms" />;
}
