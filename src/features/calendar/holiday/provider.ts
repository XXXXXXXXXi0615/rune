import cn2026DatasetText from './data/CN/2026.json?raw';
import { HOLIDAY_PROVENANCE_BY_ID } from './data/provenance';
import type { HolidayOccurrence, HolidayProviderResult, HolidayRegion } from './types';

type DatasetKey = `${HolidayRegion}:${number}`;

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function compareOccurrences(a: HolidayOccurrence, b: HolidayOccurrence): number {
  const kindOrder = { public_holiday: 0, traditional_festival: 1, makeup_workday: 2, observance: 3 } as const;
  return a.dateKey.localeCompare(b.dateKey)
    || kindOrder[a.kind] - kindOrder[b.kind]
    || a.id.localeCompare(b.id);
}

/** Returns human-actionable errors for generated or reviewed annual datasets. */
export function validateHolidayDataset(
  occurrences: readonly HolidayOccurrence[],
  expected: { region: HolidayRegion; year: number },
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const occurrence of occurrences) {
    if (!occurrence.id || ids.has(occurrence.id)) errors.push(`duplicate or missing id: ${occurrence.id || '(empty)'}`);
    ids.add(occurrence.id);
    if (!isDateKey(occurrence.dateKey)) errors.push(`invalid dateKey: ${occurrence.id}`);
    if (occurrence.region !== expected.region) errors.push(`wrong region: ${occurrence.id}`);
    if (occurrence.sourceYear !== expected.year) errors.push(`wrong sourceYear: ${occurrence.id}`);
    if (!occurrence.sourceId) errors.push(`missing sourceId: ${occurrence.id}`);
    const source = HOLIDAY_PROVENANCE_BY_ID.get(occurrence.sourceId);
    if (!source) errors.push(`unresolved provenance: ${occurrence.id}`);
    else if (source.region !== expected.region || source.year !== expected.year) errors.push(`mismatched provenance: ${occurrence.id}`);
    if (occurrence.kind === 'makeup_workday' && (occurrence.isDayOff || !occurrence.isWorkdayOverride)) errors.push(`invalid makeup workday flags: ${occurrence.id}`);
    if (occurrence.kind === 'public_holiday' && (!occurrence.isDayOff || occurrence.isWorkdayOverride)) errors.push(`invalid public holiday flags: ${occurrence.id}`);
  }
  return errors;
}

function loadReviewedDataset(raw: string, region: HolidayRegion, year: number): readonly HolidayOccurrence[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Holiday dataset ${region}/${year} must be an array.`);
  const occurrences = parsed as HolidayOccurrence[];
  const errors = validateHolidayDataset(occurrences, { region, year });
  if (errors.length > 0) throw new Error(`Invalid Holiday dataset ${region}/${year}: ${errors.join('; ')}`);
  return Object.freeze([...occurrences].sort(compareOccurrences));
}

const DATASETS = new Map<DatasetKey, readonly HolidayOccurrence[]>([
  ['CN:2026', loadReviewedDataset(cn2026DatasetText, 'CN', 2026)],
]);

/**
 * Pure, local-only annual provider. An absent dataset is deliberately
 * unavailable; it never guesses from prior years, locale, or lunar display.
 */
export function getHolidayYear(region: HolidayRegion, year: number): HolidayProviderResult {
  const occurrences = DATASETS.get(`${region}:${year}` as DatasetKey);
  return occurrences
    ? { status: 'ready', region, year, occurrences }
    : { status: 'unavailable', region, year, occurrences: [] };
}
