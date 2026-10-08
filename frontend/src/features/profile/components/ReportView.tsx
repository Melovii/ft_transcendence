import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { REPORT_DETAILS_MAX, REPORT_REASONS } from '@shared/types';
import type { ReportReason } from '@shared/types';
import { Button, Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import type { ReportState } from '../hooks/useReportUser';
import * as styles from './ReportView.styles';

export interface ReportViewProps {
  username: string;
  state: ReportState;
  onSubmit: (reason: ReportReason, details: string) => void;
  /** Back to the profile: Cancel before sending, Done after. */
  onBack: () => void;
  titleId: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * Report Player, in place of the profile inside the Profile pop-up: a reason, an optional
 * description, and Submit. Nothing is sent until a reason is chosen. While the report is
 * sending the form is read-only; once the server has stored it, or says this player was
 * already reported recently, the form gives way to that outcome, so it cannot be sent
 * twice. A failed send keeps what the user entered and can be tried again.
 */
export function ReportView({
  username,
  state,
  onSubmit,
  onBack,
  titleId,
  titleRef,
}: ReportViewProps) {
  const { t } = useTranslation();
  const reasonsId = useId();
  const detailsId = useId();
  const detailsHintId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const sending = state.status === 'SENDING';
  const done = state.status === 'SENT' || state.status === 'ALREADY_REPORTED';
  const doneRef = useRef<HTMLButtonElement>(null);

  // The outcome replaces the focused Submit; Done takes focus so the keyboard is not lost.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason && !sending) onSubmit(reason, details);
  };

  return (
    <>
      <div className={styles.header}>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
          {t('profile.report.title', { username })}
        </h2>
        {!done && <p className={styles.subtitle}>{t('profile.report.subtitle')}</p>}
      </div>

      {done ? (
        <div role="status" className={styles.outcome}>
          <Icon
            name={state.status === 'SENT' ? 'check' : 'flag'}
            className={cn(
              styles.outcomeIcon,
              styles.outcomeTone[state.status === 'SENT' ? 'success' : 'neutral'],
            )}
          />
          <p className={styles.outcomeBody}>
            {t(`profile.report.outcome.${state.status}`, { username })}
          </p>
          <Button
            ref={doneRef}
            sizeClassName={styles.button}
            onClick={onBack}
            className={styles.done}
          >
            {t('profile.report.done')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className={styles.form}>
          <fieldset className="flex flex-col gap-[8px]" aria-describedby={`${reasonsId}-hint`}>
            <legend id={reasonsId} className={cn(styles.label, 'mb-[8px]')}>
              {t('profile.report.reasonLabel')}
            </legend>
            <div className={styles.reasons}>
              {REPORT_REASONS.map((value) => (
                <label key={value} className={styles.reason}>
                  <input
                    type="radio"
                    name={reasonsId}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    disabled={sending}
                    className={styles.radio}
                  />
                  {t(`profile.report.reason.${value}`)}
                </label>
              ))}
            </div>
            <p id={`${reasonsId}-hint`} className={cn(styles.hint, !reason ? '' : 'sr-only')}>
              {t('profile.report.reasonHint')}
            </p>
          </fieldset>

          <div className="flex flex-col gap-[8px]">
            <label htmlFor={detailsId} className={styles.label}>
              {t('profile.report.detailsLabel')}
            </label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, REPORT_DETAILS_MAX))}
              readOnly={sending}
              maxLength={REPORT_DETAILS_MAX}
              placeholder={t('profile.report.detailsPlaceholder')}
              aria-describedby={detailsHintId}
              className={styles.textarea}
            />
            <p id={detailsHintId} className={styles.counter}>
              {t('profile.report.detailsCount', {
                count: details.length,
                max: REPORT_DETAILS_MAX,
              })}
            </p>
          </div>

          {state.status === 'FAILED' && (
            <p role="alert" className={styles.error}>
              {t(`profile.report.error.${state.failure}`, { username })}
            </p>
          )}

          <div className={styles.actions}>
            <Button
              variant="neutral"
              sizeClassName={styles.button}
              onClick={() => !sending && onBack()}
              aria-disabled={sending || undefined}
              className={styles.cancel}
            >
              {t('profile.report.cancel')}
            </Button>
            {/* Submit is the coral action: a report is a serious step, not a routine one. */}
            <Button
              type="submit"
              variant="secondary"
              sizeClassName={styles.button}
              aria-disabled={!reason || sending}
              aria-busy={sending}
              className={styles.submit}
            >
              {t(sending ? 'profile.report.sending' : 'profile.report.submit')}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
