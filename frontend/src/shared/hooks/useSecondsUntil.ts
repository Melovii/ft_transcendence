import { useEffect, useState } from 'react';

/**
 * Whole seconds until a deadline the server sent as an absolute time, counted down once a
 * second. `clockOffsetMs` is the server's clock minus this device's, so a device whose
 * clock is off still shows the server's remaining time. The server sends no ticks and
 * decides when the deadline has passed; this only draws it. `null` without a deadline.
 */
export function useSecondsUntil(deadline: string | null, clockOffsetMs: number): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (deadline === null) return null;
  const at = Date.parse(deadline);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - (now + clockOffsetMs)) / 1_000));
}
