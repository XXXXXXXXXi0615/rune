import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useDisciplineAlertStore } from '@/store/useDisciplineAlertStore';

export type ToiletWarningLevel = 0 | 1 | 2 | 3;
export type ToiletRiskSource = 'manual' | 'inferred';
export type BladderIncidentStatus = 'active' | 'resolved' | 'cancelled';

export interface BladderIncident {
  id: string;
  startedAt: number;
  durationSeconds: number;
  warningLevel: ToiletWarningLevel;
  status: BladderIncidentStatus;
  source: ToiletRiskSource;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  cancelledAt: number | null;
}

/**
 * Phase 1.1A: Single active bladder incident state machine.
 * - Only ONE active incident at a time.
 * - Active → generates 'urgent' alert.
 * - Resolved → clears urgent, preserves event data.
 * - Cancelled → clears urgent, marks as user mistake.
 * - No gamification: no streaks, no leaderboards, no achievements.
 */
interface BladderSafetyState {
  activeIncidentId: string | null;
  startedAt: number | null;
  durationSeconds: number;
  warningLevel: ToiletWarningLevel;
  source: ToiletRiskSource | null;
  snoozedUntil: number | null;
  incidents: BladderIncident[];
  startIncident: (source?: ToiletRiskSource, now?: number) => string;
  resolveIncident: (now?: number) => void;
  cancelIncident: (now?: number) => void;
  delayFiveMinutes: (now?: number) => void;
  tick: (now?: number) => void;
  inferFromText: (text: string, now?: number) => boolean;
}

export const inferPeeHoldIntent = (text: string) => /我在憋尿|等一下再去|先忍一下|先憋一下|晚點再去廁所/.test(text.replace(/\s+/g, ''));
export const warningLevelForSeconds = (seconds: number): ToiletWarningLevel => seconds >= 1800 ? 3 : seconds >= 1200 ? 2 : seconds >= 600 ? 1 : 0;

export const useToiletRiskStore = create<BladderSafetyState>()(persist((set, get) => ({
  activeIncidentId: null,
  startedAt: null,
  durationSeconds: 0,
  warningLevel: 0,
  source: null,
  snoozedUntil: null,
  incidents: [],
  startIncident: (source = 'manual', now = Date.now()) => {
    if (get().activeIncidentId) return get().activeIncidentId!;
    const id = `bladder_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const incident: BladderIncident = { id, startedAt: now, durationSeconds: 0, warningLevel: 0, status: 'active', source, acknowledgedAt: null, resolvedAt: null, cancelledAt: null };
    set((state) => ({
      activeIncidentId: id, startedAt: now, durationSeconds: 0, warningLevel: 0, source, snoozedUntil: null,
      incidents: [incident, ...state.incidents].slice(0, 90),
    }));
    useDisciplineAlertStore.getState().addAlert({ ruleKey: `bladder:${id}:active`, title: '如廁安全事件', message: '別把專注當理由。收拾手上工作，立刻去廁所。', severity: 'urgent', source: 'toilet_risk', copySource: 'rule_engine' }, now);
    return id;
  },
  resolveIncident: (now = Date.now()) => {
    const id = get().activeIncidentId;
    if (!id) return;
    const started = get().startedAt;
    const durationSeconds = started ? Math.max(0, Math.floor((now - started) / 1000)) : get().durationSeconds;
    set((state) => ({
      activeIncidentId: null, startedAt: null, durationSeconds: 0, warningLevel: 0, source: null, snoozedUntil: null,
      incidents: state.incidents.map((inc) => inc.id === id ? { ...inc, durationSeconds, warningLevel: warningLevelForSeconds(durationSeconds), status: 'resolved' as const, resolvedAt: now } : inc),
    }));
    useDisciplineAlertStore.getState().acknowledgeByRule(`bladder:${id}:active`, now);
    [1, 2, 3].forEach((level) => useDisciplineAlertStore.getState().acknowledgeByRule(`bladder:${id}:level:${level}`, now));
  },
  cancelIncident: (now = Date.now()) => {
    const id = get().activeIncidentId;
    if (!id) return;
    const started = get().startedAt;
    const durationSeconds = started ? Math.max(0, Math.floor((now - started) / 1000)) : get().durationSeconds;
    set((state) => ({
      activeIncidentId: null, startedAt: null, durationSeconds: 0, warningLevel: 0, source: null, snoozedUntil: null,
      incidents: state.incidents.map((inc) => inc.id === id ? { ...inc, durationSeconds, warningLevel: warningLevelForSeconds(durationSeconds), status: 'cancelled' as const, cancelledAt: now } : inc),
    }));
    useDisciplineAlertStore.getState().acknowledgeByRule(`bladder:${id}:active`, now);
    [1, 2, 3].forEach((level) => useDisciplineAlertStore.getState().acknowledgeByRule(`bladder:${id}:level:${level}`, now));
  },
  delayFiveMinutes: (now = Date.now()) => {
    if (!get().activeIncidentId) return;
    set({ snoozedUntil: now + 5 * 60 * 1000 });
  },
  tick: (now = Date.now()) => {
    const { activeIncidentId, startedAt, warningLevel, snoozedUntil } = get();
    if (!activeIncidentId || !startedAt) return;
    const durationSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const nextLevel = warningLevelForSeconds(durationSeconds);
    set((state) => ({
      durationSeconds, warningLevel: nextLevel,
      incidents: state.incidents.map((inc) => inc.id === activeIncidentId ? { ...inc, durationSeconds, warningLevel: nextLevel } : inc),
    }));
    if (nextLevel <= warningLevel || (snoozedUntil && now < snoozedUntil)) return;
    const copyByLevel: Record<1 | 2 | 3, [string, string, 'urgent']> = {
      1: ['該停一下了', '已經 10 分鐘。保存進度，去廁所。', 'urgent'],
      2: ['不要再拖', '已經 20 分鐘。現在就把身體需求放回優先序。', 'urgent'],
      3: ['立即結束憋尿', '已經 30 分鐘。請立刻去廁所；若有疼痛或不適，應尋求醫療協助。', 'urgent'],
    };
    const copy = copyByLevel[nextLevel as 1 | 2 | 3];
    useDisciplineAlertStore.getState().addAlert({ ruleKey: `bladder:${activeIncidentId}:level:${nextLevel}`, title: copy[0], message: copy[1], severity: copy[2], source: 'toilet_risk', copySource: 'rule_engine' }, now);
  },
  inferFromText: (text, now = Date.now()) => {
    if (!inferPeeHoldIntent(text) || get().activeIncidentId) return false;
    get().startIncident('inferred', now);
    return true;
  },
}), {
  name: 'lunartide-toilet-risk-v1',
  version: 2,
  migrate: (persisted: unknown, version: number) => {
    if (version < 2) {
      const raw = persisted as Record<string, unknown> | undefined;
      const oldEvents = (raw?.events as Array<Record<string, unknown>>) ?? [];
      const updated = oldEvents.map((ev) => {
        const hasResolved = ev.resolvedAt != null;
        return {
          ...ev,
          status: hasResolved ? 'resolved' : 'active',
          acknowledgedAt: null,
          cancelledAt: null,
        };
      });
      const oldActiveId = raw?.activeEventId as string | null | undefined;
      return {
        ...(raw ?? {}),
        activeIncidentId: null,
        startedAt: null,
        durationSeconds: 0,
        warningLevel: 0,
        incidents: updated,
      };
    }
    return persisted as BladderSafetyState;
  },
}));
