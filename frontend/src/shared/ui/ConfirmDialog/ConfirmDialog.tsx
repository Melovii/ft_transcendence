import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@shared/utils';
import { Button } from '@shared/ui/Button';
import { Dialog } from '@shared/ui/Dialog';
import { Icon, type IconName } from '@shared/ui/Icon';

export interface ConfirmDialogProps {
  title: string;
  /** What confirming does and what it costs. It describes the dialog. */
  body: string;
  /** Glyph drawn in a circle above the title, such as the trash can of Delete Account. */
  icon?: IconName;
  /** Content between the body and the actions, such as a warning or a confirmation field. */
  children?: ReactNode;
  /** Translated failure of the last attempt, announced when it appears. */
  error?: string | null | undefined;
  /** The safe choice, on the left. It also names the dialog's Escape. */
  cancelLabel: string;
  /** The committing choice, on the right. Callers pass the in-progress wording while pending. */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /**
   * The request is in flight: the dialog cannot be dismissed, so its result is always shown,
   * and both actions stop answering while keeping their place and their focus.
   */
  pending?: boolean;
  /** Holds the committing action back, such as until a typed confirmation matches. */
  confirmDisabled?: boolean;
}

const styles = {
  card:
    'max-w-[580px] items-center rounded-xl bg-surface px-3 pt-[28px] pb-[22px] text-center ' +
    'shadow-auth-dialog md:rounded-2xl md:px-[36px] md:pt-[40px] md:pb-[36px] ' +
    'desktop:max-w-[464px] desktop:rounded-[28px] desktop:px-[29px] desktop:pt-[32px] ' +
    'desktop:pb-[29px]',
  icon:
    'flex size-[56px] items-center justify-center rounded-pill bg-secondary-dark/10 ' +
    'text-[24px] text-accent-red',
  title:
    'text-3xl leading-[30px] font-black tracking-[-0.8px] text-text-black normal-case ' +
    'md:text-4xl md:leading-[32px] desktop:text-[26px] desktop:leading-[26px]',
  body:
    'mt-[14px] max-w-[440px] text-lg leading-[22px] font-regular text-text-black ' +
    'md:mt-[18px] md:text-2xl md:leading-[26px] desktop:mt-[16px] desktop:max-w-[352px] ' +
    'desktop:text-[18px] desktop:leading-[21px]',
  error: 'mt-[12px] text-md leading-[18px] font-bold text-accent-red desktop:text-[14px]',
  actions:
    'mt-[24px] grid w-full grid-cols-2 gap-3 md:mt-[32px] md:gap-[28px] desktop:mt-[26px] ' +
    'desktop:gap-[22px]',
  action:
    'h-[56px] rounded-lg text-2xl leading-none font-bold tracking-[-0.5px] md:h-[68px] ' +
    'md:text-3xl desktop:h-[54px] desktop:rounded-[16px] desktop:text-[22px]',
};

/**
 * The design system's confirmation modal: a title, what the action costs, and the safe
 * choice beside the committing one. Leave Room, Kick, Log Out and Delete Account all use it,
 * so every confirmation is drawn and behaves the same way.
 *
 * Phones are the base, `md:` draws the design at full size and `desktop:` at 80%, like the
 * screens these dialogs open over.
 */
export function ConfirmDialog({
  title,
  body,
  icon,
  children,
  error,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  pending = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <Dialog
      role="alertdialog"
      labelledBy={titleId}
      describedBy={bodyId}
      closeLabel={cancelLabel}
      onClose={onCancel}
      closable={!pending}
      showCloseButton={false}
      className={styles.card}
    >
      {icon && (
        <span aria-hidden="true" className={styles.icon}>
          <Icon name={icon} />
        </span>
      )}
      <h2 id={titleId} className={cn(styles.title, icon && 'mt-[14px]')}>
        {title}
      </h2>
      <p id={bodyId} className={styles.body}>
        {body}
      </p>
      {children}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          variant="neutral"
          sizeClassName={styles.action}
          aria-disabled={pending || undefined}
          onClick={() => !pending && onCancel()}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="secondary"
          sizeClassName={styles.action}
          disabled={confirmDisabled}
          aria-busy={pending || undefined}
          aria-disabled={pending || undefined}
          onClick={() => !pending && onConfirm()}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
