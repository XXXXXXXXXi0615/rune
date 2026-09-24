import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HOME_CLOCK_SETTINGS, sanitizeHomeClockSettings, useHomeClockStore } from '@/store/useHomeClockStore';

describe('Home Hero Clock preferences', () => {
  beforeEach(() => useHomeClockStore.setState({ settings: { ...DEFAULT_HOME_CLOCK_SETTINGS } }));

  it('accepts deprecated displayMode through sanitization for backward compatibility', () => {
    for (const displayMode of ['digital-primary', 'flowday-primary', 'hybrid'] as const) {
      useHomeClockStore.getState().update({ displayMode, offsetX: 80, scale: 1.3 });
      expect(useHomeClockStore.getState().settings).toMatchObject({ displayMode, offsetX: 0, scale: 1 });
    }
  });

  it('preserves all active quick-control preferences through sanitization', () => {
    expect(sanitizeHomeClockSettings({ showSeconds: false, showSolarTerm: false, showShichen: false, showPillarOutline: true })).toMatchObject({ showSeconds: false, showSolarTerm: false, showShichen: false, showPillarOutline: true });
  });
});
