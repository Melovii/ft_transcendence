## i18n Usage Guidelines

### 1. No hardcoded text

User-facing text is never written directly inside JSX.

// ❌ <button>Save</button>
// ✅ <button>{t('common.save')}</button>

### 2. Using `t()`

Any component displaying translated text uses:

const { t } = useTranslation();

**Note:** If a key is missing in the selected language, i18next first
falls back to the fallback language (`en`). Only if the key is missing
from every locale file does it fail to resolve — in that case no error
is thrown, and the key itself is rendered on screen (e.g.
`profile.deleteAccount`). This usually means a translation is missing
and should be added to all three locale files.

### 3. Key structure

Each language has a single JSON file. Feature groups are nested as
objects inside that file.

locales/
├── en.json
├── tr.json
└── fr.json

{
"common": {
"save": "Save",
"cancel": "Cancel",
"language": "Language"
},
"profile": {
"title": "Profile",
"edit": "Edit profile"
},
"auth": {
"login": {
"title": "Log in",
"submit": "Sign in"
}
},
"errors": {
"network": "Connection failed",
"unknown": "Something went wrong"
}
}

t('common.save');
t('profile.title');
t('auth.login.submit');
t('errors.network');

- Shared text: common.*
- Feature-specific text: profile._, auth._, game.*
  (as new features are added, their namespace is added to the JSON)
- User-facing error text: errors.*

No new locale file is created for a new feature; the same key is
added to en.json, tr.json, and fr.json.

### 4. Text with variables (interpolation)

Added to the existing `common` object in `en.json`:

"welcome": "Welcome, {{name}}"

t('common.welcome', { name: user.name });

### 5. Error code mapping

REST and WebSocket error codes are never shown directly to the user.
Codes are mapped to `errors.*` keys before being displayed:

const translationKey =
ERROR_KEY_BY_CODE[errorCode] ?? 'errors.unknown';

t(translationKey);

The shared error-code-to-translation-key mapping is defined in the
shared i18n layer once the REST and WebSocket error contracts are
finalized. Both REST and WebSocket clients use this mapping before
showing an error to the user.

### 6. Choosing the language

`LanguageSelector` (`shared/i18n/LanguageSelector.tsx`) is the language switch. It sits in
Settings and in the Landing page footer. Picking a language calls `changeLanguage()` from
`shared/i18n/i18n.ts`, which re-renders every `t()` in place, without a reload, and saves
the choice on this device under `ft_transcendence.language`. On the next visit that saved
language is restored; an unknown or unreadable value falls back to `en`.

Dates and numbers follow the selected language: format them with `Intl` and
`i18n.language`, for example
`new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' })`. Plural text
uses i18next's `_one` / `_other` keys with a `count` value.

### 7. Shared UI components

Components in `shared/ui` never contain user-facing text. They take every label through
props, so the feature that renders them translates it:

<Toast onDismiss={dismiss} dismissLabel={t('common.dismiss')}>…</Toast>
<ErrorState title={t('…')} onRetry={retry} retryLabel={t('common.retry')} />

