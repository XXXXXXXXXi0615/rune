import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DisciplineAlertSeverity = 'info' | 'attention' | 'urgent';
export type DisciplineAlertSource = 'hydration' | 'toilet_risk' | 'focus' | 'discipline';
export type DisciplineCopySource = 'rule_engine' | 'ai_generated';

export interface DisciplineAlert {
  id: string;
  ruleKey: string;
  title: string;
  message: string;
  severity: DisciplineAlertSeverity;
  source: DisciplineAlertSource;
  copySource: DisciplineCopySource;
  createdAt: number;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
}

interface DisciplineAlertState {
  alerts: DisciplineAlert[];
  addAlert: (alert: Omit<DisciplineAlert, 'id' | 'createdAt' | 'acknowledgedAt' | 'resolvedAt'>, now?: number) => string;
  /** Upsert: same ruleKey+not resolved → update. Acknowledged → new lifecycle. Not found → create. */
  upsertAlert: (alert: Omit<DisciplineAlert, 'id' | 'createdAt' | 'acknowledgedAt' | 'resolvedAt'>, now?: number) => string;
  acknowledgeAlert: (id: string, now?: number) => void;
  acknowledgeByRule: (ruleKey: string, now?: number) => void;
  resolveAlert: (id: string, now?: number) => void;
}

export const useDisciplineAlertStore = create<DisciplineAlertState>()(persist((set, get) => ({
  alerts: [],
  addAlert: (input, now = Date.now()) => {
    const existing = get().alerts.find((item) => item.ruleKey === input.ruleKey && !item.acknowledgedAt && !item.resolvedAt);
    if (existing) return existing.id;
    const id = `alert_${now}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ alerts: [{ ...input, id, createdAt: now, acknowledgedAt: null, resolvedAt: null }, ...state.alerts].slice(0, 120) }));
    return id;
  },
  upsertAlert: (input, now = Date.now()) => {
    const activeExisting = get().alerts.find((item) => item.ruleKey === input.ruleKey && !item.resolvedAt);
    if (activeExisting && !activeExisting.acknowledgedAt) {
      // Same lifecycle — update title/message/severity in-place
      set((state) => ({
        alerts: state.alerts.map((item) =>
          item.id === activeExisting.id
            ? { ...item, title: input.title, message: input.message, severity: input.severity }
            : item,
        ),
      }));
      return activeExisting.id;
    }
    if (activeExisting && activeExisting.acknowledgedAt) {
      // Previous was acknowledged — create fresh lifecycle
      const id = `alert_${now}_${Math.random().toString(36).slice(2, 7)}`;
      set((state) => ({ alerts: [{ ...input, id, createdAt: now, acknowledgedAt: null, resolvedAt: null }, ...state.alerts].slice(0, 120) }));
      return id;
    }
    // No existing active with this ruleKey — create new
    const id = `alert_${now}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ alerts: [{ ...input, id, createdAt: now, acknowledgedAt: null, resolvedAt: null }, ...state.alerts].slice(0, 120) }));
    return id;
  },
  acknowledgeAlert: (id, now = Date.now()) => set((state) => ({ alerts: state.alerts.map((item) => item.id === id ? { ...item, acknowledgedAt: now } : item) })),
  acknowledgeByRule: (ruleKey, now = Date.now()) => set((state) => ({ alerts: state.alerts.map((item) => item.ruleKey === ruleKey && !item.acknowledgedAt && !item.resolvedAt ? { ...item, acknowledgedAt: now } : item) })),
  resolveAlert: (id, now = Date.now()) => set((state) => ({ alerts: state.alerts.map((item) => item.id === id && !item.resolvedAt ? { ...item, resolvedAt: now } : item) })),
}), {
  name: 'lunartide-discipline-alerts-v1',
  version: 2,
  migrate: (persisted: unknown, version: number) => {
    if (version < 2) {
      const raw = persisted as Record<string, unknown> | undefined;
      const alerts = (raw?.alerts as Array<Record<string, unknown>>) ?? [];
      const updated = alerts.map((a) => {
        const severity = a.severity;
        let newSeverity: string = severity as string;
        if (severity === 'warning') newSeverity = 'attention';
        if (severity === 'critical') newSeverity = 'urgent';
        return { ...a, severity: newSeverity, resolvedAt: a.resolvedAt ?? null };
      });
      return { ...(raw ?? {}), alerts: updated };
    }
    return persisted as DisciplineAlertState;
  },
}));
