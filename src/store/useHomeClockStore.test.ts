import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HOME_CLOCK_SETTINGS, useHomeClockStore } from './useHomeClockStore';

describe('home clock preference persistence model', () => {
  beforeEach(() => useHomeClockStore.setState({ settings: { ...DEFAULT_HOME_CLOCK_SETTINGS } }));
  it('keeps the hero anchor and footprint fixed', () => {
    useHomeClockStore.getState().update({ offsetX: 42, offsetY: 18, scale: 1.2, align: 'right' });
    expect(useHomeClockStore.getState().settings).toMatchObject({ offsetX: 0, offsetY: 0, scale: 1, align: 'center', draggable: false });
  });
  it('resets position and size', () => {
    useHomeClockStore.getState().update({ offsetX: 99, scale: 1.4 });
    useHomeClockStore.getState().reset();
    expect(useHomeClockStore.getState().settings).toEqual(DEFAULT_HOME_CLOCK_SETTINGS);
  });
});
