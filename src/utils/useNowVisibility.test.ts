import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '@/hooks/useNow';

function ClockProbe({ onValue }: { onValue: (value: number) => void }) {
  onValue(useNow('minute').getTime());
  return null;
}

describe('shared useNow visibility correction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('synchronizes directly to current wall time when hidden becomes visible', () => {
    const values: number[] = [];
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    vi.setSystemTime(new Date('2026-08-02T10:04:00'));
    act(() => root.render(createElement(ClockProbe, { onValue: (value) => values.push(value) })));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    vi.setSystemTime(new Date('2026-08-02T10:27:00'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(new Date(values.at(-1)!).getMinutes()).toBe(27);
    act(() => root.unmount());
  });
});
