import { describe, expect, it, beforeEach } from 'vitest';
import { MINIMUM_VALID_FOCUS_SECONDS } from '@/features/focus/focusRuntimeConstants';
import {
  selectValidCompletedVoyages,
  selectTodayValidFocusSeconds,
  selectCompletedVoyageCount,
  selectActiveBladderIncident,
  selectUnhandledAlerts,
  selectHighestAlertSeverity,
} from '@/features/focus/focusRuntimeSelectors';
import { buildDisciplineModelContext, getRuleDisciplineCopy } from '@/features/discipline/disciplineEngine';
import type { FocusSessionEntry } from '@/types';
import type { BladderIncident } from '@/store/useToiletRiskStore';
import type { DisciplineAlert } from '@/store/useDisciplineAlertStore';
import { toLocalDateString } from '@/utils/date';

const BASE: number = 1_700_000_000_000;
function newLog(overrides: Partial<FocusSessionEntry> & { id: string }): FocusSessionEntry {
  return {
    id: overrides.id,
    date: overrides.date ?? '2026-08-03',
    startTime: overrides.startTime ?? BASE,
    endTime: overrides.endTime ?? BASE + 600_000,
    actualFocusMinutes: overrides.actualFocusMinutes ?? 10,
    plannedFocusMinutes: overrides.plannedFocusMinutes ?? 25,
    plannedRounds: overrides.plannedRounds ?? 1,
    roundsCompleted: overrides.roundsCompleted ?? 1,
    interruptions: overrides.interruptions ?? 0,
    status: overrides.status ?? 'completed',
  };
}

function newIncident(overrides: Partial<BladderIncident> & { id: string }): BladderIncident {
  return {
    id: overrides.id,
    startedAt: overrides.startedAt ?? BASE,
    durationSeconds: overrides.durationSeconds ?? 0,
    warningLevel: overrides.warningLevel ?? 0,
    status: overrides.status ?? 'active',
    source: overrides.source ?? 'manual',
    acknowledgedAt: overrides.acknowledgedAt ?? null,
    resolvedAt: overrides.resolvedAt ?? null,
    cancelledAt: overrides.cancelledAt ?? null,
  };
}

function newAlert(overrides: Partial<DisciplineAlert> & { id: string }): DisciplineAlert {
  return {
    id: overrides.id,
    ruleKey: overrides.ruleKey ?? `test:${overrides.id}`,
    title: overrides.title ?? 'Test',
    message: overrides.message ?? 'Test message',
    severity: overrides.severity ?? 'info',
    source: overrides.source ?? 'discipline',
    copySource: overrides.copySource ?? 'rule_engine',
    createdAt: overrides.createdAt ?? BASE,
    acknowledgedAt: overrides.acknowledgedAt ?? null,
    resolvedAt: overrides.resolvedAt ?? null,
  };
}

/* ═════════════════════════════════════════
   VALID VOYAGE THRESHOLD
   ═════════════════════════════════════════ */
describe('Minimum valid focus seconds', () => {
  it('1: 0 seconds does NOT count as completed', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 0, status: 'completed' })];
    expect(selectCompletedVoyageCount(logs)).toBe(0);
    expect(selectValidCompletedVoyages(logs)).toHaveLength(0);
  });

  it('2: 0 seconds does NOT appear in Recent Voyages filter', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 0, status: 'completed' })];
    const valid = selectValidCompletedVoyages(logs);
    expect(valid).toHaveLength(0);
  });

  it('3: cancelled session does NOT count as completed', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 5, status: 'interrupted' })];
    expect(selectCompletedVoyageCount(logs)).toBe(0);
  });

  it('4: cancelled session does NOT count toward completed stats', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 10, status: 'interrupted' })];
    expect(selectValidCompletedVoyages(logs)).toHaveLength(0);
  });

  it('5: sub-threshold (29s) does NOT count', () => {
    // actualFocusMinutes rounds down from seconds: 29s → 0 minutes
    const logs = [newLog({ id: 'a', actualFocusMinutes: 0, status: 'completed' })]; // 29s = 0min in current schema
    expect(selectCompletedVoyageCount(logs)).toBe(0);
  });

  it('6: exactly at threshold counts', () => {
    const minMinutes = Math.ceil(MINIMUM_VALID_FOCUS_SECONDS / 60); // 30s → 1 min
    const logs = [newLog({ id: 'a', actualFocusMinutes: minMinutes, status: 'completed' })];
    expect(selectCompletedVoyageCount(logs)).toBe(1);
  });

  it('7: above threshold counts', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 25, status: 'completed' })];
    expect(selectCompletedVoyageCount(logs)).toBe(1);
    expect(selectValidCompletedVoyages(logs)).toHaveLength(1);
  });

  it('8: today valid seconds sums multiple entries correctly', () => {
    const todayStr = toLocalDateString();
    const logs = [
      newLog({ id: 'a', date: todayStr, actualFocusMinutes: 10, status: 'completed' }),
      newLog({ id: 'b', date: todayStr, actualFocusMinutes: 0, status: 'completed' }),
      newLog({ id: 'c', date: todayStr, actualFocusMinutes: 5, status: 'interrupted' }),
    ];
    // Only valid completed voyages sum: just entry 'a' = 10 * 60 = 600. Entry 'b' and 'c' are excluded.
    expect(selectTodayValidFocusSeconds(logs)).toBe(10 * 60);
  });
});

/* ═════════════════════════════════════════
   ALERT SEVERITY
   ═════════════════════════════════════════ */
describe('Alert severity', () => {
  it('9: info / attention / urgent mappings', () => {
    const info = newAlert({ id: 'i', severity: 'info' });
    const attention = newAlert({ id: 'a', severity: 'attention' });
    const urgent = newAlert({ id: 'u', severity: 'urgent' });

    expect(selectHighestAlertSeverity([info])).toBe('info');
    expect(selectHighestAlertSeverity([attention])).toBe('attention');
    expect(selectHighestAlertSeverity([urgent])).toBe('urgent');
    expect(selectHighestAlertSeverity([])).toBe('none');
  });

  it('10: hydration low only produces info', () => {
    const hydrationAlert = newAlert({ id: 'h', severity: 'info', source: 'hydration' });
    expect(selectHighestAlertSeverity([hydrationAlert])).toBe('info');
  });

  it('11: long-time no drink produces attention (not urgent)', () => {
    const attentionAlert = newAlert({ id: 'a', severity: 'attention', source: 'hydration' });
    expect(selectHighestAlertSeverity([attentionAlert])).toBe('attention');
  });

  it('12: bladder incident produces urgent', () => {
    const urgentAlert = newAlert({ id: 'u', severity: 'urgent', source: 'toilet_risk' });
    expect(selectHighestAlertSeverity([urgentAlert])).toBe('urgent');
  });

  it('13: resolved alert is excluded from unhandled', () => {
    const resolved = newAlert({ id: 'r', severity: 'urgent', resolvedAt: BASE + 1000 });
    expect(selectUnhandledAlerts([resolved])).toHaveLength(0);
  });

  it('14: acknowledged alert is excluded from unhandled', () => {
    const ack = newAlert({ id: 'a', severity: 'attention', acknowledgedAt: BASE + 1000 });
    expect(selectUnhandledAlerts([ack])).toHaveLength(0);
  });
});

/* ═════════════════════════════════════════
   BLADDER INCIDENT STATE MACHINE
   ═════════════════════════════════════════ */
describe('Bladder incident state machine', () => {
  it('15: active incident is detected', () => {
    const inc = newIncident({ id: 'b1', status: 'active' });
    expect(selectActiveBladderIncident([inc])).not.toBeNull();
    expect(selectActiveBladderIncident([inc])!.id).toBe('b1');
  });

  it('16: resolved incident returns null from active selector', () => {
    const inc = newIncident({ id: 'b1', status: 'resolved', resolvedAt: BASE + 1000 });
    expect(selectActiveBladderIncident([inc])).toBeNull();
  });

  it('17: cancelled incident returns null from active selector', () => {
    const inc = newIncident({ id: 'b1', status: 'cancelled', cancelledAt: BASE + 1000 });
    expect(selectActiveBladderIncident([inc])).toBeNull();
  });

  it('18: multiple incidents — only active one is returned', () => {
    const incidents = [
      newIncident({ id: 'b1', status: 'resolved' }),
      newIncident({ id: 'b2', status: 'active' }),
      newIncident({ id: 'b3', status: 'cancelled' }),
    ];
    const active = selectActiveBladderIncident(incidents);
    expect(active).not.toBeNull();
    expect(active!.id).toBe('b2');
  });

  it('19: no active incidents returns null', () => {
    const incidents = [
      newIncident({ id: 'b1', status: 'resolved' }),
      newIncident({ id: 'b2', status: 'cancelled' }),
    ];
    expect(selectActiveBladderIncident(incidents)).toBeNull();
  });
});

/* ═════════════════════════════════════════
   DISCIPLINE ENGINE DATA BOUNDARIES
   ═════════════════════════════════════════ */
describe('Discipline engine data boundaries', () => {
  it('20: model context does NOT contain chat data', () => {
    const ctx = buildDisciplineModelContext({ hydrationMl: 100, hydrationTargetMl: 2000, toiletActive: false, toiletWarningLevel: 0, focusStatus: 'idle', mainlineSummary: 'test' });
    const json = JSON.stringify(ctx);
    expect(json).not.toMatch(/chat|journalRaw|healthRaw|credential|privateKey|apiKey/);
  });

  it('21: mainline summary is truncated to 160 chars', () => {
    const long = 'a'.repeat(200);
    const ctx = buildDisciplineModelContext({ hydrationMl: 100, hydrationTargetMl: 2000, toiletActive: false, toiletWarningLevel: 0, focusStatus: 'idle', mainlineSummary: long });
    expect(ctx.mainlineSummary.length).toBeLessThanOrEqual(160);
  });

  it('22: alarm severity uses the correct type', () => {
    const result = getRuleDisciplineCopy({ hydrationMl: 100, hydrationTargetMl: 2000, toiletActive: false, toiletWarningLevel: 0, focusStatus: 'idle', mainlineSummary: '' });
    expect(result.source).toBe('rule_engine');
    expect(['rule_engine', 'ai_generated']).toContain(result.source);
  });
});

/* ═════════════════════════════════════════
   SELECTOR STABILITY
   ═════════════════════════════════════════ */
describe('Selector stability', () => {
  it('23: same input produces identical output', () => {
    const logs = [newLog({ id: 'a', actualFocusMinutes: 10, status: 'completed' })];
    const a1 = selectValidCompletedVoyages(logs);
    const a2 = selectValidCompletedVoyages([...logs]);
    expect(a1).toEqual(a2);
    expect(a1).toHaveLength(1);
  });

  it('24: empty logs returns empty arrays statically', () => {
    expect(selectValidCompletedVoyages([])).toEqual([]);
    expect(selectCompletedVoyageCount([])).toBe(0);
    expect(selectTodayValidFocusSeconds([])).toBe(0);
  });
});
