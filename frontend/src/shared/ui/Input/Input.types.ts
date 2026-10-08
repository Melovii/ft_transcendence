import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

import type { IconName } from '@shared/ui/Icon';

/** Validation state the field paints. `default` is the neutral, unvalidated field. */
export type InputStatus = 'default' | 'error' | 'success';

/** Geometry only: `md` is the standard field, `lg` the room-code sized field. */
export type InputSize = 'md' | 'lg';

interface FieldProps {
  /** Visible label. Required, because every field is labelled. */
  label: string;
  /** Hides the label visually while keeping it for assistive technology. */
  hideLabel?: boolean;
  status?: InputStatus;
  /** Message under the field. Read as an error when `status` is `error`. */
  message?: string;
  /** Hint under the field, shown when there is no message. */
  hint?: string;
  size?: InputSize;
}

export interface InputProps
  extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingIcon?: IconName;
  trailingIcon?: IconName;
}

export interface TextareaProps extends FieldProps, TextareaHTMLAttributes<HTMLTextAreaElement> {}
