import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityEvent, NormalizedAgentTelemetryEvent } from './types';

const persisted: ActivityEvent[] = [];
vi.mock('./repository', () => ({
  saveActivityEvents: vi.fn(async (events: ActivityEvent[]) => { for (const event of events) { const index = persisted.findIndex((item) => item.id === event.id); if (index >= 0) persisted[index] = event; else persisted.push(event); } }),
  loadAllActivityEvents: vi.fn(async () => [...persisted]),
}));

import { ingestAgentTelemetry, useActivityLedgerStore } from './activityLedgerStore';

const event: NormalizedAgentTelemetryEvent = { id: 'same-external-id', timestamp: 100, sourceId: 'fixture', sourceKind: 'external', runId: 'run', kind: 'run_start', title: 'Fixture run' };

describe('canonical Activity Ledger agent ingestion', () => {
  beforeEach(() => { persisted.splice(0); useActivityLedgerStore.setState({ events: [], hydrated: false }); });

  it('deduplicates the same external event in memory and persistence', async () => {
    await ingestAgentTelemetry(event);
    await ingestAgentTelemetry(event);
    expect(useActivityLedgerStore.getState().events).toHaveLength(1);
    expect(persisted).toHaveLength(1);
  });

  it('hydrates persisted normalized events with stable identity and ordering', async () => {
    const stored = await ingestAgentTelemetry(event);
    useActivityLedgerStore.setState({ events: [], hydrated: false });
    await useActivityLedgerStore.getState().hydrate();
    expect(useActivityLedgerStore.getState().events).toEqual([stored]);
  });
});
