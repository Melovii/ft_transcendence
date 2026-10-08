import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import tr from './locales/tr.json';

const LANGUAGE_FLAG = 'ft_transcendence.language';
const DEFAULT_LANGUAGE = 'en';

/** The three agreed languages; each one's name is written in that language. */
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'fr', name: 'Français' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const isLanguage = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((language) => language.code === value);

/** The language saved on this device, or `null` when there is none or storage is blocked. */
function savedLanguage(): LanguageCode | null {
  try {
    const value = localStorage.getItem(LANGUAGE_FLAG);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers the choice on this device; the UI still switches when storage is blocked. */
function saveLanguage(language: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_FLAG, language);
  } catch {
    // Private mode or blocked site data: the choice lasts until the page closes.
  }
}

/** Switches every rendered translation at once, without a reload, and remembers it. */
export function changeLanguage(language: LanguageCode): void {
  saveLanguage(language);
  void i18n.changeLanguage(language);
}

function updateDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
}

const initialLanguage = savedLanguage() ?? DEFAULT_LANGUAGE;

updateDocumentLanguage(initialLanguage);
i18n.on('languageChanged', updateDocumentLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: initialLanguage,
  supportedLngs: LANGUAGES.map((language) => language.code),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

export { DEFAULT_LANGUAGE, LANGUAGE_FLAG, LANGUAGES };
export default i18n;
