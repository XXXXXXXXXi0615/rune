// ================================================================
// useNow — minute-tick + visibilitychange + midnight-crossover.
//
// Returns a `now` Date. By default ticks every minute (cheap), so date-only
// countdowns don't re-render every second but still cross midnight on time.
// Pass `tickMode: 'second'` for events that need wall-clock time.
//   - Cleans timers on unmount.
//   - HMR-safe: each mount re-creates timers; React strict mode double-mount
//     is handled by the cleanup pair.
//   - Triggers on visibilitychange (returns to foreground).
//   - Triggers on timezone change (heuristic: re-evaluate Intl offset).
// ================================================================

import { useEffect, useState } from 'react';

export type UseNowTickMode = 'minute' | 'second';

const MS_MINUTE = 60_000;
const MS_SECOND = 1_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function msUntilNextMinute(now: Date): number {
  return MS_MINUTE - (now.getTime() % MS_MINUTE);
}

function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1_000, next.getTime() - now.getTime());
}

function getTimezoneOffset(d: Date): number {
  return d.getTimezoneOffset();
}

export function useNow(tickMode: UseNowTickMode = 'minute'): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastDayKey = startOfLocalDay(now).getTime();
    let lastOffset = getTimezoneOffset(now);

    const tick = () => {
      if (!active) return;
      const next = new Date();
      setNow(next);
      const day = startOfLocalDay(next).getTime();
      if (day !== lastDayKey) {
        lastDayKey = day;
        // immediate recompute is fine, no special handling
      }
      if (getTimezoneOffset(next) !== lastOffset) {
        lastOffset = getTimezoneOffset(next);
      }
    };

    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      const intervalMs = tickMode === 'second' ? MS_SECOND : MS_MINUTE;
      const wait = tickMode === 'second' ? MS_SECOND : msUntilNextMinute(new Date());
      timer = setTimeout(() => {
        tick();
        if (tickMode === 'second') {
          scheduleNext();
        } else {
          scheduleNext();
        }
      }, wait);
    };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        tick();
        if (tickMode === 'minute') scheduleNext();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    scheduleNext();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickMode]);

  return now;
}

// Single midnight timer, e.g. for components that only care about date change.
export function useMidnightRefresh(onCross: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(() => {
        onCross();
        schedule();
      }, msUntilNextDay(new Date()));
    };
    schedule();
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = new Date();
        const lastDay = startOfLocalDay(now);
        const ms = now.getTime() - lastDay.getTime();
        // First 5 minutes of a new day → fire callback to refresh.
        if (ms < 5 * 60_000) onCross();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [onCross]);
}
