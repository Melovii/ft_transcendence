/**
 * One request at a time for an auth form.
 *
 * `run()` shows the field errors the local rules found and, when there are none, runs
 * the request. A second submit while one is in flight — a double click, Enter pressed
 * twice — is dropped before it reaches the network. After a failed check, focus moves to
 * the first invalid field so a keyboard user lands on what needs fixing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSubmitGuard() {
  const formRef = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  /**
   * `request` resolves `true` when it succeeded and hands the screen over — the form
   * then stays busy until it unmounts — and `false` when the user may try again.
   */
  const run = useCallback(
    <Errors extends object>(
      invalid: Errors,
      showErrors: (errors: Errors) => void,
      request: () => Promise<boolean>,
    ) => {
      if (pending.current) return;

      showErrors(invalid);
      if (Object.keys(invalid).length > 0) {
        setFocusRequest((count) => count + 1);
        return;
      }

      pending.current = true;
      setSubmitting(true);
      void request()
        .catch(() => false)
        .then((done) => {
          if (done || !mounted.current) return;
          pending.current = false;
          setSubmitting(false);
          setFocusRequest((count) => count + 1);
        });
    },
    [],
  );

  return { formRef, submitting, run };
}
