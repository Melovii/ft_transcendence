import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@shared/utils';

import { LANGUAGES, changeLanguage } from './i18n';

export interface LanguageSelectorProps {
  /** Id of the visible heading that names the control; without one it names itself. */
  labelledBy?: string;
  /** `sm` sits in a line of footer text; `md` stands on its own in a form. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The language switch: one option per agreed language, each named in its own language so
 * a reader can find theirs whatever the page is in. Picking one re-renders every
 * translation in place — no reload — and the choice is remembered on this device.
 *
 * It is a native radio group, so arrow keys move between the languages and assistive
 * technology announces the current one.
 */
export function LanguageSelector({ labelledBy, size = 'md', className }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation();
  const name = useId();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div
      role="radiogroup"
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': t('i18n.label') })}
      className={cn(
        'inline-flex rounded-pill bg-surface-muted',
        size === 'md' ? 'gap-1 p-1' : 'gap-0.5 p-0.5',
        className,
      )}
    >
      {LANGUAGES.map(({ code, name: languageName }) => (
        <label
          key={code}
          lang={code}
          className={cn(
            'cursor-pointer rounded-pill font-bold',
            size === 'md'
              ? 'px-3 py-1 text-md leading-[22px]'
              : 'px-2 py-0.5 text-sm leading-[18px]',
            'text-text-slate transition-[background-color,color] duration-200 ease-pop',
            'hover:bg-surface hover:text-text-ink',
            'has-checked:bg-primary has-checked:text-surface has-checked:shadow-alert',
            'has-focus-visible:outline-(length:--stroke-heavy) has-focus-visible:outline-offset-2',
            'has-focus-visible:outline-primary has-focus-visible:outline-solid',
          )}
        >
          <input
            type="radio"
            name={name}
            value={code}
            checked={current === code}
            onChange={() => changeLanguage(code)}
            className="sr-only"
          />
          {languageName}
        </label>
      ))}
    </div>
  );
}
