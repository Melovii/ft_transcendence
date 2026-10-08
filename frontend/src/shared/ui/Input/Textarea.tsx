import { useId } from 'react';

import { cn } from '@shared/utils';

import { FieldMessage } from './FieldMessage';
import { controlBase, statusStyles } from './Input.styles';
import type { TextareaProps } from './Input.types';

/** Multi-line field. Same label, status and message contract as `Input`. */
export function Textarea({
  label,
  hideLabel = false,
  status = 'default',
  message,
  hint,
  className,
  id,
  rows = 3,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const noteId = `${textareaId}-note`;
  const note = message ?? hint;

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        htmlFor={textareaId}
        className={cn('text-sm font-bold text-text', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          controlBase,
          statusStyles[status],
          'resize-y rounded-md p-3 text-md',
          className,
        )}
        {...props}
      />

      {note && (
        <FieldMessage id={noteId} status={message ? status : 'default'}>
          {note}
        </FieldMessage>
      )}
    </div>
  );
}
