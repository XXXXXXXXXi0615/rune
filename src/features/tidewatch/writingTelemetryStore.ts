import { create } from 'zustand';
import type {
  WritingTelemetryEvent,
  WritingActor,
  WritingSurface,
} from './types';
import { countWritingGraphemes } from '@/utils/countWritingGraphemes';
import { saveWritingEvents, loadAllWritingEvents } from './repository';

/**
 * TIDEWATCH — writing telemetry runtime store.
 *
 * Maintains an in-memory buffer of today's writing events.
 * Persists to IndexedDB on flush (called from the global subscription).
 *
 * Privacy: events contain only numeric counts. No raw text is stored.
 */

interface WritingTelemetryState {
  todayEvents: WritingTelemetryEvent[];
  totalEvents: number;
  hydrated: boolean;
  hydrating: boolean;
  pendingEvents: WritingTelemetryEvent[];
  recordEvent: (event: Omit<WritingTelemetryEvent, 'id' | 'timestamp'>) => string;
  flush: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let hydratingPromise: Promise<void> | null = null;

export const useWritingTelemetryStore = create<WritingTelemetryState>((set, get) => ({
  todayEvents: [],
  totalEvents: 0,
  hydrated: false,
  hydrating: false,
  pendingEvents: [],

  recordEvent: (partial) => {
    const event: WritingTelemetryEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...partial,
    };
    set((s) => ({
      todayEvents: [...s.todayEvents, event],
      pendingEvents: [...s.pendingEvents, event],
      totalEvents: s.totalEvents + 1,
    }));
    return event.id;
  },

  flush: async () => {
    const { pendingEvents } = get();
    if (pendingEvents.length === 0) return;
    set({ pendingEvents: [] });
    await saveWritingEvents(pendingEvents);
  },

  hydrate: async () => {
    const { hydrated } = get();
    if (hydrated) return;
    if (hydratingPromise) return hydratingPromise;

    set({ hydrating: true });
    hydratingPromise = (async () => {
      try {
        const all = await loadAllWritingEvents();
        const now = Date.now();
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const todayStart = dayStart.getTime();
        const todayEvents = all.filter((e) => e.timestamp >= todayStart);
        set({
          todayEvents,
          totalEvents: all.length,
          hydrated: true,
          hydrating: false,
        });
      } catch {
        set({ hydrated: true, hydrating: false });
      } finally {
        hydratingPromise = null;
      }
    })();
    return hydratingPromise;
  },
}));

/**
 * Record a user writing event.
 * inputChars = newly inserted grapheme clusters during authoring.
 * committedChars = text actually sent / published / saved.
 *
 * Deletion does NOT subtract historic input volume.
 * Avoid counting prefilled values as new typing.
 */
export function recordUserWriting(
  surface: WritingSurface,
  inputChars: number,
  committedChars: number,
  sourceId?: string,
): string {
  return useWritingTelemetryStore.getState().recordEvent({
    actor: 'user',
    surface,
    inputChars: countWritingGraphemes(String(inputChars)),
    committedChars: countWritingGraphemes(String(committedChars)),
    sourceId,
  });
}

/**
 * Record an agent writing event.
 * inputChars = 0 (agent doesn't "type").
 * committedChars = finalized visible output count.
 */
export function recordAgentWriting(
  surface: WritingSurface,
  committedChars: number,
  sourceId?: string,
): string {
  return useWritingTelemetryStore.getState().recordEvent({
    actor: 'agent',
    surface,
    inputChars: 0,
    committedChars: countWritingGraphemes(String(committedChars)),
    sourceId,
  });
}
