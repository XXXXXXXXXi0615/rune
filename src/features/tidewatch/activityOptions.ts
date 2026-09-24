import type { CheckIn, CheckInActivity } from './types';

/**
 * TIDEWATCH — check-in activity options.
 *
 * Presentation-owned option table + pure derivation helpers. This module
 * never persists anything: the canonical history is `useCheckInStore.checkIns`
 * (IndexedDB-backed). No second recent-list storage is introduced here.
 */

export interface CheckInActivityOption {
  value: CheckInActivity;
  label: string;
}

/** Every canonical activity value ever accepted by the check-in system. */
export const CHECKIN_KNOWN_ACTIVITIES: readonly string[] = [
  'working',
  'studying',
  'creating',
  'exercising',
  'resting',
  'relaxing',
  'socialising',
  'commuting',
];

/** Quick Pick primary options (single-select). "自訂" is handled by the form. */
export const CHECKIN_QUICK_OPTIONS: CheckInActivityOption[] = [
  { value: 'working', label: '工作' },
  { value: 'studying', label: '學習' },
  { value: 'creating', label: '創作' },
  { value: 'exercising', label: '運動' },
  { value: 'resting', label: '休息' },
];

/** NOW / collapsed presentation labels, including legacy values. */
export const CHECKIN_ACTIVITY_LABELS: Record<string, string> = {
  checkin: '已簽到',
  working: '工作中',
  studying: '學習中',
  creating: '創作中',
  exercising: '運動中',
  resting: '休息中',
  relaxing: '放鬆',
  socialising: '社交',
  commuting: '通勤中',
};

export function isCheckInKnown(activity: string): boolean {
  return CHECKIN_KNOWN_ACTIVITIES.includes(activity);
}

/**
 * Derive most recent unique custom activities from canonical history.
 * Newest first, presets and blanks ignored, capped at `max`. Pure read-only.
 */
export function deriveRecentCustomActivities(checkIns: CheckIn[], max = 3): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const ordered = [...checkIns].sort((a, b) => b.createdAt - a.createdAt);
  for (const checkin of ordered) {
    const value = String(checkin.activity ?? '').trim();
    if (!value || isCheckInKnown(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= max) break;
  }
  return result;
}
