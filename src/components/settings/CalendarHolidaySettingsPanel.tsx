import { useAppStore } from '@/store/useAppStore';
import type { HolidayRegion } from '@/features/calendar/holiday/types';

/**
 * Calendar Phase 3B-3 — the one explicit UI surface for the canonical
 * `holidayRegion` preference (owner: `useAppStore` / `lunartide_data` v3).
 *
 * The control writes through the existing canonical setter only; it never
 * touches localStorage directly and never infers a region from IP, locale,
 * language or timezone. `不顯示` is the explicit `null` choice.
 */

export const HOLIDAY_REGION_OPTIONS: ReadonlyArray<{ value: HolidayRegion | null; label: string }> = [
  { value: null, label: '不顯示' },
  { value: 'CN', label: '中國大陸' },
  { value: 'TW', label: '台灣' },
  { value: 'HK', label: '香港' },
  { value: 'JP', label: '日本' },
  { value: 'US', label: '美國' },
];

export function CalendarHolidaySettingsPanel() {
  const holidayRegion = useAppStore((state) => state.holidayRegion);
  const setHolidayRegion = useAppStore((state) => state.setHolidayRegion);

  return (
    <div className="settings-module-stack" data-testid="calendar-holiday-settings">
      <div className="settings-module-list">
        <div className="settings-standard-row">
          <span className="settings-standard-copy">
            <span>節假日地區</span>
            <small>選擇要顯示的節假日曆。未提供資料的年份或地區不會自動推算。</small>
          </span>
        </div>
        <div className="calendar-holiday-region" role="radiogroup" aria-label="節假日地區">
          {HOLIDAY_REGION_OPTIONS.map((option) => {
            const selected = holidayRegion === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'is-active' : ''}
                data-holiday-region={option.value ?? 'none'}
                onClick={() => setHolidayRegion(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
