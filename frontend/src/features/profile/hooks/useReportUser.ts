/**
 * REPORT on another player's profile: file one report and say how it went.
 *
 * One request at a time: a press while one is in flight is ignored, and once the server
 * has stored the report the form is replaced by its confirmation, so the same report
 * cannot be sent twice by accident. The server also refuses a repeat report of the same
 * player within its window (`ALREADY_REPORTED`), which reads as a settled outcome rather
 * than an error to retry.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@shared/api';
import type { ReportReason } from '@shared/types';

import { reportUser } from '../api';

export type ReportFailure = 'NOT_FOUND' | 'RATE_LIMITED' | 'INVALID' | 'FAILED';

export type ReportState =
  | { status: 'EDITING' }
  | { status: 'SENDING' }
  | { status: 'SENT' }
  | { status: 'ALREADY_REPORTED' }
  | { status: 'FAILED'; failure: ReportFailure };

function failureOf(error: unknown): ReportState {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case 'ALREADY_REPORTED':
      return { status: 'ALREADY_REPORTED' };
    case 'USER_NOT_FOUND':
      return { status: 'FAILED', failure: 'NOT_FOUND' };
    case 'RATE_LIMITED':
      return { status: 'FAILED', failure: 'RATE_LIMITED' };
    case 'VALIDATION_ERROR':
    case 'CANNOT_REPORT_SELF':
      return { status: 'FAILED', failure: 'INVALID' };
    default:
      return { status: 'FAILED', failure: 'FAILED' };
  }
}

export function useReportUser(userId: number, roomId: number | null) {
  const [state, setState] = useState<ReportState>({ status: 'EDITING' });
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (reason: ReportReason, details: string) => {
      if (busy.current) return;
      busy.current = true;
      setState({ status: 'SENDING' });
      const text = details.trim();
      try {
        await reportUser(userId, {
          reason,
          ...(text ? { details: text } : {}),
          ...(roomId !== null ? { room_id: roomId } : {}),
        });
        if (mounted.current) setState({ status: 'SENT' });
      } catch (error) {
        busy.current = false;
        if (mounted.current) setState(failureOf(error));
      }
    },
    [roomId, userId],
  );

  return { state, submit };
}
