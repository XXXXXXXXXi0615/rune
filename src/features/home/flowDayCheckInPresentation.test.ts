import { describe, expect, it } from 'vitest';
import { fiveElementOf, type FlowDayPillar } from '@/calendar/core';
import type { CheckInRecord } from '@/features/tideclock/types';
import { buildFlowDayCheckInPresentation, elementLabel, resolveFlowDayCheckInStatus } from './flowDayCheckInPresentation';

function pillar(label: string): FlowDayPillar {
  const [stem, branch] = [...label];
  return { stem, branch, label, stemElement: fiveElementOf(stem), branchElement: fiveElementOf(branch) };
}

function record(status: CheckInRecord['status'], isLate = false): CheckInRecord {
  return { id: 'fixture', date: '2026-08-15', kind: 'clock_in', status, clockInAt: '2026-08-15T04:35:00.000Z', clockOutAt: null, isLate, graceMinutesUsed: 0, report: null, makeupReason: null, moonDewAwarded: 0, ticketNumber: 'FIXTURE', createdAt: '2026-08-15T04:35:00.000Z', updatedAt: '2026-08-15T04:35:00.000Z' };
}

describe('Flow-Day Check-in presentation', () => {
  it.each([
    ['辛酉', '金', '金'], ['丙午', '火', '火'], ['戊辰', '土', '土'], ['壬子', '水', '水'], ['甲寅', '木', '木'],
  ])('maps %s through canonical five-element metadata', (label, stemLabel, branchLabel) => {
    const value = pillar(label);
    expect(elementLabel(value.stemElement)).toBe(stemLabel);
    expect(elementLabel(value.branchElement)).toBe(branchLabel);
  });

  it('composes the canonical 2026-08-15 Flow Day without percentages', () => {
    const model = buildFlowDayCheckInPresentation(new Date('2026-08-15T07:00:00.000Z'));
    expect(model.dayPillar.label).toBe('辛酉');
    expect(model.dayPillar.stemElement).toBe('metal');
    expect(model.dayPillar.branchElement).toBe('metal');
    expect(model.calendarContext).toBe('立秋 · 申月');
    expect(JSON.stringify(model)).not.toMatch(/%|百分比/);
  });

  it.each([
    [undefined, 'pending'], [record('completed'), 'completed'], [record('late', true), 'late'], [record('completed', true), 'late'], [record('makeup_required'), 'pending'],
  ] as const)('derives check-in status without creating another record', (value, expected) => {
    expect(resolveFlowDayCheckInStatus(value)).toBe(expected);
  });
});
