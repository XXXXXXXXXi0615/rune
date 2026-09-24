import { beforeEach, describe, expect, it } from 'vitest';
import { HOLIDAY_REGION_OPTIONS } from './CalendarHolidaySettingsPanel';
import { useAppStore } from '@/store/useAppStore';

/**
 * Phase 3B-3 — canonical holidayRegion preference UI mapping.
 * The panel writes through the existing store setter only; these assertions
 * pin the frozen option → value mapping and the absence of any second owner.
 */

describe('Holiday region preference UI', () => {
  beforeEach(() => {
    useAppStore.setState({ holidayRegion: null });
    localStorage.removeItem('lunartide_data');
  });

  it('offers 不顯示 + the five canonical regions with the exact labels', () => {
    expect(HOLIDAY_REGION_OPTIONS.map((option) => option.label)).toEqual(['不顯示', '中國大陸', '台灣', '香港', '日本', '美國']);
    expect(HOLIDAY_REGION_OPTIONS.map((option) => option.value)).toEqual([null, 'CN', 'TW', 'HK', 'JP', 'US']);
  });

  it('writes through the canonical setter and persists an explicit null', () => {
    const setter = useAppStore.getState().setHolidayRegion;
    setter('TW');
    expect(useAppStore.getState().holidayRegion).toBe('TW');
    expect(JSON.parse(localStorage.getItem('lunartide_data') || '{}').state.holidayRegion).toBe('TW');
    setter(null);
    expect(useAppStore.getState().holidayRegion).toBeNull();
    expect(JSON.parse(localStorage.getItem('lunartide_data') || '{}').state.holidayRegion).toBeNull();
  });

  it('creates no second storage key for the preference', () => {
    const before = Object.keys(localStorage).sort();
    useAppStore.getState().setHolidayRegion('CN');
    useAppStore.getState().setHolidayRegion(null);
    expect(Object.keys(localStorage).filter((key) => !before.includes(key))).toEqual([]);
    expect(Object.keys(localStorage).some((key) => /holiday/i.test(key))).toBe(false);
  });
});
