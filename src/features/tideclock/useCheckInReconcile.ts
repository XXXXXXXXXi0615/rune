import { useEffect } from 'react';
import { toLocalDateString } from '@/utils/date';
import { useCheckInStore } from './useCheckInStore';

const DAY_WATCH_MS = 30_000;

/**
 * App-level day-close reconcile trigger. Idempotent by construction: it only
 * writes ended days that have no canonical record yet, so reloads, component
 * remounts and visibility changes never re-apply a consequence. Runs
 * independently of whether any check-in UI is open.
 */
export function useCheckInReconcile(): void {
  const reconcileMissedDays = useCheckInStore((state) => state.reconcileMissedDays);

  useEffect(() => {
    let lastDay = toLocalDateString();

    const run = () => {
      lastDay = toLocalDateString();
      reconcileMissedDays();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    const timer = window.setInterval(() => {
      if (toLocalDateString() !== lastDay) run();
    }, DAY_WATCH_MS);

    run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [reconcileMissedDays]);
}
