import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  dayGanzhi,
  fiveElementOf,
  type FiveElement,
} from './ganzhi';
import { calendarDateKey, calendarDateTimeParts, deviceCalendarTimezone } from './calendarTimezone';
import { SOLAR_TERM_NAMES, solarTermGuardInstant, solarTermInstant } from './solarTerms';

export type FlowDayBoundary = 'midnight';
export interface FlowDayClockOptions { calendarTimeZone?: string }

export interface FlowDayPillar {
  stem: string;
  branch: string;
  label: string;
  stemElement: FiveElement;
  branchElement: FiveElement;
}

export interface FlowDayClockState {
  yearPillar: FlowDayPillar;
  monthPillar: FlowDayPillar;
  dayPillar: FlowDayPillar;
  hourPillar: FlowDayPillar;
  solarTerm: string;
  timezone: string;
  dayBoundary: FlowDayBoundary;
  boundaryKeys: { year: string; month: string; day: string; hour: string };
  accuracy: 'verified';
}

function pillar(stemIndex: number, branchIndex: number): FlowDayPillar {
  const stem = HEAVENLY_STEMS[((stemIndex % 10) + 10) % 10];
  const branch = EARTHLY_BRANCHES[((branchIndex % 12) + 12) % 12];
  return { stem, branch, label: `${stem}${branch}`, stemElement: fiveElementOf(stem), branchElement: fiveElementOf(branch) };
}

function latestSolarTerm(now: Date, civilYear: number): { year: number; index: number; name: string; instant: Date } {
  const candidates: Array<{ year: number; index: number; name: string; instant: Date }> = [];
  for (const year of [civilYear - 1, civilYear]) {
    SOLAR_TERM_NAMES.forEach((name, index) => candidates.push({ year, index, name, instant: solarTermGuardInstant(year, index) }));
  }
  return candidates.filter((term) => term.instant.getTime() <= now.getTime()).at(-1)!;
}

function yearForGanzhi(now: Date, year: number): number {
  return now.getTime() >= solarTermInstant(year, 2).getTime() ? year : year - 1;
}

function monthOrderFromLatestTerm(term: { year: number; index: number }): { order: number; key: string } {
  // Month pillars change only at the 12 節: 立春、驚蟄…小寒 (even indexes).
  let latest = term;
  if (latest.index % 2 === 1) latest = { year: latest.year, index: latest.index - 1 };
  if (term.index === 0 && term.index % 2 === 0) return { order: 11, key: `${term.year}-00` };
  if (latest.index < 2) {
    const priorYear = term.year - 1;
    return { order: 10, key: `${priorYear}-22` };
  }
  return { order: (latest.index - 2) / 2, key: `${latest.year}-${String(latest.index).padStart(2, '0')}` };
}

export function getFlowDayBoundaryKeys(now: Date, options: FlowDayClockOptions = {}) {
  const timezone = options.calendarTimeZone ?? deviceCalendarTimezone();
  const civil = calendarDateTimeParts(now, timezone);
  const term = latestSolarTerm(now, civil.year);
  const year = yearForGanzhi(now, civil.year);
  const month = monthOrderFromLatestTerm(term);
  const dateKey = calendarDateKey(now, timezone);
  const hourBranch = Math.floor(((civil.hour + 1) % 24) / 2);
  return { year: String(year), month: month.key, day: dateKey, hour: `${dateKey}-${hourBranch}` };
}

export function calculateFlowDayClock(now: Date, options: FlowDayClockOptions = {}): FlowDayClockState {
  const timezone = options.calendarTimeZone ?? deviceCalendarTimezone();
  const civil = calendarDateTimeParts(now, timezone);
  const term = latestSolarTerm(now, civil.year);
  const ganzhiYear = yearForGanzhi(now, civil.year);
  const yearStemIndex = ((ganzhiYear - 4) % 10 + 10) % 10;
  const yearBranchIndex = ((ganzhiYear - 4) % 12 + 12) % 12;
  const month = monthOrderFromLatestTerm(term);
  const monthBranchIndex = (2 + month.order) % 12;
  const firstMonthStem = ((yearStemIndex % 5) * 2 + 2) % 10;
  const dateKey = calendarDateKey(now, timezone); // canonical configured rule: midnight in calendar timezone
  const dayLabel = dayGanzhi(dateKey);
  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayLabel[0] as (typeof HEAVENLY_STEMS)[number]);
  const dayBranchIndex = EARTHLY_BRANCHES.indexOf(dayLabel[1] as (typeof EARTHLY_BRANCHES)[number]);
  const hourBranchIndex = Math.floor(((civil.hour + 1) % 24) / 2);
  const hourStemIndex = ((dayStemIndex % 5) * 2 + hourBranchIndex) % 10;

  return {
    yearPillar: pillar(yearStemIndex, yearBranchIndex),
    monthPillar: pillar(firstMonthStem + month.order, monthBranchIndex),
    dayPillar: pillar(dayStemIndex, dayBranchIndex),
    hourPillar: pillar(hourStemIndex, hourBranchIndex),
    solarTerm: term.name,
    timezone,
    dayBoundary: 'midnight',
    boundaryKeys: getFlowDayBoundaryKeys(now, options),
    accuracy: 'verified',
  };
}
