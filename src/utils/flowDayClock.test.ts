import { describe, expect, it } from 'vitest';
import { calculateFlowDayClock, calendarDateKey, calendarDateTimeParts, fiveElementOf, solarTermInstant } from '@/calendar/core';
import { SOLAR_TERM_REFERENCE_FIXTURES } from '@/calendar/core/solarTermReferenceFixtures';

const SHANGHAI = { calendarTimeZone: 'Asia/Shanghai' } as const;
function shanghaiDate(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0));
}

describe('Flow Day Clock canonical Ganzhi model', () => {
  it('matches the deterministic 2026-08-15 fixture', () => {
    const model = calculateFlowDayClock(shanghaiDate(2026, 8, 15, 15), SHANGHAI);
    expect(model.yearPillar.label).toBe('丙午');
    expect(model.monthPillar.label).toBe('丙申');
    expect(model.dayPillar.label).toBe('辛酉');
    expect(model.hourPillar.label).toBe('丙申');
  });

  it('uses canonical five-element metadata for stems and branches', () => {
    expect(['甲', '乙', '寅', '卯'].map(fiveElementOf)).toEqual(['wood', 'wood', 'wood', 'wood']);
    expect(fiveElementOf('丙')).toBe('fire');
    expect(fiveElementOf('戊')).toBe('earth');
    expect(fiveElementOf('辛')).toBe('metal');
    expect(fiveElementOf('亥')).toBe('water');
  });

  it.each([
    [14, 59, '乙未'], [15, 0, '丙申'], [16, 59, '丙申'], [17, 0, '丁酉'],
  ])('changes hour pillar only at a shichen boundary: %i:%i', (hour, minute, expected) => {
    expect(calculateFlowDayClock(shanghaiDate(2026, 8, 15, hour, minute), SHANGHAI).hourPillar.label).toBe(expected);
  });

  it('keeps the day through 23:00 and changes at canonical local midnight', () => {
    expect(calculateFlowDayClock(shanghaiDate(2026, 8, 15, 22, 59), SHANGHAI).dayPillar.label).toBe('辛酉');
    const ziBeforeMidnight = calculateFlowDayClock(shanghaiDate(2026, 8, 15, 23, 0), SHANGHAI);
    const ziAfterMidnight = calculateFlowDayClock(shanghaiDate(2026, 8, 16, 0, 0), SHANGHAI);
    expect(ziBeforeMidnight.dayPillar.label).toBe('辛酉');
    expect(ziAfterMidnight.dayPillar.label).toBe('壬戌');
    expect(ziBeforeMidnight.hourPillar.branch).toBe('子');
    expect(ziAfterMidnight.hourPillar.branch).toBe('子');
  });

  it('changes the month pillar at the solar-term instant', () => {
    const boundary = solarTermInstant(2026, 14);
    const before = calculateFlowDayClock(new Date(boundary.getTime() - 1), SHANGHAI);
    const after = calculateFlowDayClock(boundary, SHANGHAI);
    expect(before.monthPillar.label).toBe('乙未');
    expect(after.monthPillar.label).toBe('丙申');
  });

  it.each(SOLAR_TERM_REFERENCE_FIXTURES)('keeps $year $term within the 180-second verified tolerance', (fixture) => {
    const delta = Math.abs(solarTermInstant(fixture.year, fixture.term).getTime() - Date.parse(fixture.referenceInstant));
    expect(delta).toBeLessThanOrEqual(180_000);
  });

  it.each(SOLAR_TERM_REFERENCE_FIXTURES.filter((fixture) => fixture.term === '立春'))(
    'switches the Ganzhi year exactly at $year 立春 T±1ms', (fixture) => {
      const boundary = solarTermInstant(fixture.year, fixture.term);
      expect(calculateFlowDayClock(new Date(+boundary - 1), SHANGHAI).boundaryKeys.year).toBe(String(fixture.year - 1));
      expect(calculateFlowDayClock(boundary, SHANGHAI).boundaryKeys.year).toBe(String(fixture.year));
      expect(calculateFlowDayClock(new Date(+boundary + 1), SHANGHAI).boundaryKeys.year).toBe(String(fixture.year));
    },
  );

  it.each(SOLAR_TERM_REFERENCE_FIXTURES.filter((fixture) => fixture.term !== '小寒'))(
    'switches Jie month keys only at $year $term when the fixture is a Jie', (fixture) => {
      const index = ['小寒','大寒','立春','雨水','驚蟄','春分','清明','穀雨','立夏','小滿','芒種','夏至','小暑','大暑','立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'].indexOf(fixture.term);
      if (index % 2 !== 0) return;
      const boundary = solarTermInstant(fixture.year, fixture.term);
      const before = calculateFlowDayClock(new Date(+boundary - 1), SHANGHAI).boundaryKeys.month;
      expect(calculateFlowDayClock(boundary, SHANGHAI).boundaryKeys.month).not.toBe(before);
      expect(calculateFlowDayClock(new Date(+boundary + 1), SHANGHAI).boundaryKeys.month).not.toBe(before);
    },
  );

  it('separates the absolute instant from IANA civil-time projection across DST', () => {
    expect(calendarDateTimeParts(new Date('2026-03-08T06:59:59Z'), 'America/New_York').hour).toBe(1);
    expect(calendarDateTimeParts(new Date('2026-03-08T07:00:00Z'), 'America/New_York').hour).toBe(3);
    expect(calendarDateTimeParts(new Date('2026-11-01T08:59:59Z'), 'America/Los_Angeles').hour).toBe(1);
    expect(calendarDateTimeParts(new Date('2026-11-01T09:00:00Z'), 'America/Los_Angeles').hour).toBe(1);
  });

  it('derives local midnight from the requested calendar timezone, not the test machine', () => {
    const instant = new Date('2026-08-15T16:00:00Z');
    expect(calendarDateKey(instant, 'UTC')).toBe('2026-08-15');
    expect(calendarDateKey(instant, 'Asia/Shanghai')).toBe('2026-08-16');
    expect(calendarDateKey(instant, 'America/New_York')).toBe('2026-08-15');
  });

  it('rejects dates outside the verified 1901-2100 range', () => {
    expect(() => solarTermInstant(1900, '立春')).toThrow(RangeError);
    expect(() => solarTermInstant(2101, '立春')).toThrow(RangeError);
  });
});
