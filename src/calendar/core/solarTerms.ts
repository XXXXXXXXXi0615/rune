import { SearchSunLongitude } from 'astronomy-engine';

export const SOLAR_TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨',
  '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const;

export type SolarTermName = (typeof SOLAR_TERM_NAMES)[number];
export type CalendarAccuracy = 'verified' | 'estimated' | 'unsupported';

export interface SolarTermOccurrence {
  year: number;
  index: number;
  name: SolarTermName;
  longitudeDegrees: number;
  instant: Date;
  accuracy: CalendarAccuracy;
  provider: string;
}

export interface SolarTermProvider {
  readonly id: string;
  readonly verifiedRange: readonly [number, number];
  get(year: number, term: SolarTermName | number): SolarTermOccurrence;
}

const MONTH_BY_INDEX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] as const;
const LONGITUDE_BY_INDEX = [285, 300, 315, 330, 345, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270] as const;

export const astronomySolarTermProvider: SolarTermProvider = {
  id: 'astronomy-engine-2.1.19',
  verifiedRange: [1901, 2100],
  get(year, term) {
    if (!Number.isInteger(year) || year < this.verifiedRange[0] || year > this.verifiedRange[1]) {
      throw new RangeError(`Solar terms are unsupported outside ${this.verifiedRange[0]}-${this.verifiedRange[1]}`);
    }
    const index = typeof term === 'number' ? term : SOLAR_TERM_NAMES.indexOf(term);
    if (index < 0 || index >= SOLAR_TERM_NAMES.length) throw new RangeError(`Unknown solar term: ${String(term)}`);
    const start = new Date(Date.UTC(year, MONTH_BY_INDEX[index], 1));
    const result = SearchSunLongitude(LONGITUDE_BY_INDEX[index], start, 40);
    if (!result) throw new Error(`Solar term solver did not converge: ${year} ${SOLAR_TERM_NAMES[index]}`);
    return {
      year, index, name: SOLAR_TERM_NAMES[index], longitudeDegrees: LONGITUDE_BY_INDEX[index],
      instant: result.date, accuracy: 'verified', provider: this.id,
    };
  },
};

/** Internal one-year guard band used to resolve the start of 1901. Not a supported public result. */
export function solarTermGuardInstant(year: number, termIndex: number): Date {
  if (year !== 1900) return solarTermInstant(year, termIndex);
  const result = SearchSunLongitude(LONGITUDE_BY_INDEX[termIndex], new Date(Date.UTC(year, MONTH_BY_INDEX[termIndex], 1)), 40);
  if (!result) throw new Error(`Solar term guard solver did not converge: ${year} ${termIndex}`);
  return result.date;
}

export const canonicalSolarTermProvider = astronomySolarTermProvider;

export function solarTermInstant(year: number, term: SolarTermName | number): Date {
  return canonicalSolarTermProvider.get(year, term).instant;
}
