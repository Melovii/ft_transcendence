import { useId } from 'react';

import { cn } from '@shared/utils';
import { Icon } from '@shared/ui/Icon';

import { FieldMessage } from './FieldMessage';
import { controlBase, iconPadding, sizeStyles, statusStyles } from './Input.styles';
import type { InputProps } from './Input.types';

/**
 * Labelled text field.
 *
 * The label, the control and the line under it are one unit: the message is wired to the
 * control with `aria-describedby`, and an error also sets `aria-invalid`, so assistive
 * technology announces the failure with the field rather than on its own.
 */
export function Input({
  label,
  hideLabel = false,
  status = 'default',
  message,
  hint,
  size = 'md',
  leadingIcon,
  trailingIcon,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = message ?? hint;

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-bold text-text', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <div className="relative flex items-center">
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            className="pointer-events-none absolute left-3 text-lg text-text"
          />
        )}

        <input
          id={inputId}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            controlBase,
            sizeStyles[size],
            statusStyles[status],
            leadingIcon && iconPadding.leading,
            trailingIcon && iconPadding.trailing,
            className,
          )}
          {...props}
        />

        {trailingIcon && (
          <Icon
            name={trailingIcon}
            className="pointer-events-none absolute right-3 text-lg text-text"
          />
        )}
      </div>

      {note && (
        <FieldMessage id={noteId} status={message ? status : 'default'}>
          {note}
        </FieldMessage>
      )}
    </div>
  );
}
