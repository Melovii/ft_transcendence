import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { messageAge } from '../model/messages';

/** Re-render once a minute, so an age like `2m` keeps counting while the list is open. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** How long ago a message was sent, in the short form the conversation list uses. */
export function MessageAge({ iso }: { iso: string }) {
  const { t, i18n } = useTranslation();
  const age = messageAge(iso, useMinuteClock());
  const label =
    age.unit === 'NOW'
      ? t('chat.age.now')
      : age.unit === 'DATE'
        ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(
            age.date,
          )
        : t(`chat.age.${age.unit}`, { count: age.count });
  return <time dateTime={iso}>{label}</time>;
}
