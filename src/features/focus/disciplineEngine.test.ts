import { beforeEach, describe, expect, it } from 'vitest';
import { buildDisciplineModelContext, getRuleDisciplineCopy } from '@/features/discipline/disciplineEngine';
import { inferPeeHoldIntent, useToiletRiskStore, warningLevelForSeconds } from '@/store/useToiletRiskStore';
import { useDisciplineAlertStore } from '@/store/useDisciplineAlertStore';

describe('TIDEBOUND discipline engine', () => {
  beforeEach(() => {
    useToiletRiskStore.setState({ activeIncidentId: null, startedAt: null, durationSeconds: 0, warningLevel: 0, source: null, snoozedUntil: null, incidents: [] });
    useDisciplineAlertStore.setState({ alerts: [] });
  });

  it('runs a local rule fallback without any model', () => {
    const copy = getRuleDisciplineCopy({ hydrationMl: 100, hydrationTargetMl: 2000, toiletActive: false, toiletWarningLevel: 0, focusStatus: 'idle', mainlineSummary: '完成報告' });
    expect(copy.source).toBe('rule_engine');
    expect(copy.message).toContain('250 ml');
  });

  it('only builds the approved summary payload for a future model', () => {
    const context = buildDisciplineModelContext({ hydrationMl: 800, hydrationTargetMl: 2000, toiletActive: true, toiletWarningLevel: 1, focusStatus: 'running', mainlineSummary: '整理 Phase 1 驗收' });
    expect(context).toEqual({ hydration: { totalMl: 800, targetMl: 2000 }, toilet: { active: true, warningLevel: 1 }, focus: { status: 'running' }, mainlineSummary: '整理 Phase 1 驗收' });
    expect(JSON.stringify(context)).not.toMatch(/chat|journal|healthRaw|messages/);
  });

  it('detects explicit phrases but ignores unrelated text', () => {
    expect(inferPeeHoldIntent('我在憋尿，先忍一下')).toBe(true);
    expect(inferPeeHoldIntent('我等等要整理報告')).toBe(false);
  });

  it('escalates and resolves one persisted incident without a second timer authority', () => {
    const start = 1_000_000;
    useToiletRiskStore.getState().startIncident('manual', start);
    useToiletRiskStore.getState().tick(start + 20 * 60 * 1000);
    expect(warningLevelForSeconds(1200)).toBe(2);
    expect(useToiletRiskStore.getState().warningLevel).toBe(2);
    expect(useDisciplineAlertStore.getState().alerts.some((alert) => alert.severity === 'urgent')).toBe(true);
    useToiletRiskStore.getState().resolveIncident(start + 21 * 60 * 1000);
    expect(useToiletRiskStore.getState().activeIncidentId).toBeNull();
    const incident = useToiletRiskStore.getState().incidents[0];
    expect(incident.status).toBe('resolved');
    expect(incident.resolvedAt).toBe(start + 21 * 60 * 1000);
  });

  it('cancels an incident and clears urgent state', () => {
    const start = 1_000_000;
    useToiletRiskStore.getState().startIncident('manual', start);
    expect(useToiletRiskStore.getState().activeIncidentId).toBeTruthy();
    useToiletRiskStore.getState().cancelIncident(start + 1000);
    expect(useToiletRiskStore.getState().activeIncidentId).toBeNull();
    const incident = useToiletRiskStore.getState().incidents[0];
    expect(incident.status).toBe('cancelled');
    expect(incident.cancelledAt).toBe(start + 1000);
  });

  it('prevents duplicate active incidents', () => {
    const start = 1_000_000;
    const id1 = useToiletRiskStore.getState().startIncident('manual', start);
    const id2 = useToiletRiskStore.getState().startIncident('manual', start + 1000);
    expect(id1).toBe(id2);
    expect(useToiletRiskStore.getState().incidents.length).toBe(1);
  });
});
