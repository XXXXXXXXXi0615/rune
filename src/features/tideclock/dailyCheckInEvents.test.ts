import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useCheckInStore } from './useCheckInStore';
import { subscribeDailyCheckInCompleted } from './dailyCheckInEvents';

describe('daily check-in completion event', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    useCheckInStore.setState({ records: [], corrections: [], settlements: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('emits exactly once for first success and isolates listener errors', () => {
    const received: string[] = [];
    const offThrow = subscribeDailyCheckInCompleted(() => { throw new Error('presentation failed'); });
    const off = subscribeDailyCheckInCompleted(({ date }) => received.push(date));
    try {
      expect(useCheckInStore.getState().clockIn()).not.toBeNull();
      expect(useCheckInStore.getState().clockIn()).toBeNull();
      expect(received).toEqual(['2026-09-28']);
      useCheckInStore.getState().reconcileMissedDays();
      useCheckInStore.getState().submitMakeup('2026-09-27', 'reason');
      expect(received).toHaveLength(1);
    } finally { off(); offThrow(); }
  });

  it('emits once for late success, not for existing records or hydration', () => {
    const received: string[] = [];
    const off = subscribeDailyCheckInCompleted(({ date }) => received.push(date));
    try {
      useCheckInStore.setState((state) => ({ policy: { ...state.policy, clockInDeadline: '08:00', graceMinutes: 0 } }));
      expect(useCheckInStore.getState().clockIn()).toMatchObject({ status: 'late' });
      expect(received).toEqual(['2026-09-28']);
      const records = useCheckInStore.getState().records;
      useCheckInStore.setState({ records });
      expect(useCheckInStore.getState().clockIn()).toBeNull();
      expect(received).toHaveLength(1);
    } finally { off(); }
  });

  it('does not emit when the canonical action rejects a report and honors unsubscribe', () => {
    const received: string[] = [];
    const off = subscribeDailyCheckInCompleted(({ date }) => received.push(date));
    useCheckInStore.setState((state) => ({ policy: { ...state.policy, mode: 'report', requireReport: true } }));
    expect(useCheckInStore.getState().clockIn({ sleepOk: true, mainTask: '', curfewNote: '' })).toBeNull();
    expect(received).toEqual([]);
    off();
    expect(useCheckInStore.getState().clockIn({ sleepOk: true, mainTask: '今日任務', curfewNote: '' })).not.toBeNull();
    expect(received).toEqual([]);
  });
});
