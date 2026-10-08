import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToastStore } from '@shared/stores';
import type { ToastNotice } from '@shared/stores';
import { Toast, ToastStack } from '@shared/ui';

/** How long an app-level toast stays up before it dismisses itself. */
const TOAST_MS = 6_000;

function AppToast({ notice }: { notice: ToastNotice }) {
  const { t } = useTranslation();
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(notice.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [dismiss, notice.id]);

  return (
    <Toast
      tone={notice.tone}
      icon={notice.icon}
      onDismiss={() => dismiss(notice.id)}
      dismissLabel={t('common.dismiss')}
    >
      {t(notice.message)}
    </Toast>
  );
}

/** The app-level toast host, mounted once beside the routes. */
export function AppToasts() {
  const toasts = useToastStore((state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <ToastStack>
      {toasts.map((notice) => (
        <AppToast key={notice.id} notice={notice} />
      ))}
    </ToastStack>
  );
}
