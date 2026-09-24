import { create } from 'zustand';
import type { ActivityEvent, NormalizedAgentTelemetryEvent, WritingSurface, MilestoneScope } from './types';
import { saveActivityEvents, loadAllActivityEvents } from './repository';
import { normalizeAgentTelemetry, sortActivityEvents } from './agentTelemetry';

/**
 * TIDEWATCH — activity ledger store.
 *
 * One ActivityEvent model supporting:
 *   checkin, writing, writing_milestone, quest_nudge, quest_start, quest_complete, note
 *
 * Activity events store metadata only as needed.
 * Do not duplicate Quest records — quest-related events store questId/type/timestamp;
 * quest details still come from TIDEQUEST.
 */

interface ActivityLedgerState {
  events: ActivityEvent[];
  hydrated: boolean;
  emitActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  ingestAgentTelemetry: (event: NormalizedAgentTelemetryEvent) => Promise<ActivityEvent>;
  flush: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let activityHydrating: Promise<void> | null = null;

export const useActivityLedgerStore = create<ActivityLedgerState>((set, get) => ({
  events: [],
  hydrated: false,

  emitActivity: (partial) => {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...partial,
    };
    set((s) => ({ events: sortActivityEvents([...s.events, event]) }));
  },

  ingestAgentTelemetry: async (input) => {
    const event = normalizeAgentTelemetry(input);
    const existing = get().events.find((item) => item.id === event.id);
    if (existing) return existing;
    await saveActivityEvents([event]);
    set((state) => ({ events: sortActivityEvents([...state.events.filter((item) => item.id !== event.id), event]) }));
    return event;
  },

  flush: async () => {
    const { events } = get();
    if (events.length === 0) return;
    await saveActivityEvents(events);
  },

  hydrate: async () => {
    if (get().hydrated) return;
    if (activityHydrating) return activityHydrating;

    activityHydrating = (async () => {
      try {
        const events = await loadAllActivityEvents();
        set({
          events: sortActivityEvents(events),
          hydrated: true,
        });
      } catch {
        set({ hydrated: true });
      } finally {
        activityHydrating = null;
      }
    })();
    return activityHydrating;
  },
}));

/** Canonical ingestion seam. UI components never write agent events directly. */
export function ingestAgentTelemetry(event: NormalizedAgentTelemetryEvent): Promise<ActivityEvent> {
  return useActivityLedgerStore.getState().ingestAgentTelemetry(event);
}

export async function emitCheckInActivity(activity: string): Promise<void> {
  const store = useActivityLedgerStore.getState();
  store.emitActivity({ type: 'checkin', title: activity });
  await useActivityLedgerStore.getState().flush();
}

// ---------------------------------------------------------------------------
// Convenience emitters
// ---------------------------------------------------------------------------

export function emitWritingActivity(
  surface: WritingSurface,
  chars: number,
): void {
  useActivityLedgerStore.getState().emitActivity({
    type: 'writing',
    metadata: { surface, chars },
  });
}

export function emitMilestoneActivity(
  scope: MilestoneScope,
  name: string,
  threshold: number,
): void {
  useActivityLedgerStore.getState().emitActivity({
    type: 'writing_milestone',
    metadata: { scope, milestoneName: name, milestoneThreshold: threshold },
  });
}

export function emitQuestNudgeActivity(
  questId: string,
  questTitle: string,
): void {
  useActivityLedgerStore.getState().emitActivity({
    type: 'quest_nudge',
    metadata: { questId, questTitle },
  });
}

export function emitQuestStartActivity(
  questId: string,
  questTitle: string,
): void {
  useActivityLedgerStore.getState().emitActivity({
    type: 'quest_start',
    metadata: { questId, questTitle },
  });
}

export function emitQuestCompleteActivity(
  questId: string,
  questTitle: string,
): void {
  useActivityLedgerStore.getState().emitActivity({
    type: 'quest_complete',
    metadata: { questId, questTitle },
  });
}
