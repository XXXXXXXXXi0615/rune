// ================================================================
// TIDECOUNT Phase 1 — Countdown Store
//
// Single source of truth for CountdownEvent.
//   - Persists to localStorage under `lunartide_countdown_v1`.
//   - Old/missing records are auto-migrated on read (timezone fallback
//     to local TZ; no title/date used as id; UUID enforced).
//   - Home widget config persists separately (`lunartide_countdown_widget_v1`)
//     and references events by id only — never duplicates event data.
// ================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type CountdownDirection,
  type CountdownEvent,
  type CountdownRecurrence,
  type CountdownRecurrenceType,
  detectLocalTimezone,
  newCountdownId,
} from './countdownEngine';

export type CountdownWidgetSize = 'small' | 'medium' | 'large';

export interface CountdownWidgetConfig {
  size: CountdownWidgetSize;
  /** When set, render this event as the main slot; otherwise pick
   *  the nearest upcoming. */
  pinnedEventId?: string;
  /** Number of secondary events to render (0–2). */
  secondaryCount: 0 | 1 | 2;
  /** Render the cover image as backdrop if available. */
  showBackgroundImage: boolean;
  /** Hide past events entirely from the list. */
  hideElapsed: boolean;
}

export interface CountdownState {
  events: CountdownEvent[];
  /** Schema version for future migrations. */
  schemaVersion: number;
  /** Home widget configuration (single slot). */
  widgetConfig: CountdownWidgetConfig;
  /** Hydration flag — true once persist middleware has merged. */
  _hydrated: boolean;

  // ── mutations ──
  addEvent: (draft: CountdownEventDraft) => string;
  updateEvent: (id: string, patch: Partial<CountdownEventDraft>) => void;
  deleteEvent: (id: string) => void;
  togglePinnedToHome: (id: string) => void;
  setHomeOrder: (ids: string[]) => void;
  setWidgetConfig: (patch: Partial<CountdownWidgetConfig>) => void;
  pinToWidget: (eventId: string | null) => void;
}

export interface CountdownEventDraft {
  title: string;
  targetAt: string;
  targetTime?: string;
  timezone?: string;
  direction: CountdownDirection;
  recurrence: CountdownRecurrence;
  includeTargetDay: boolean;
  showTime: boolean;
  colorToken?: string;
  iconId?: string;
  coverAssetId?: string;
  pinnedToHome?: boolean;
}

const DEFAULT_WIDGET_CONFIG: CountdownWidgetConfig = {
  size: 'medium',
  secondaryCount: 1,
  showBackgroundImage: false,
  hideElapsed: false,
};

const SCHEMA_VERSION = 1;

const RECURRENCE_TYPES: CountdownRecurrenceType[] = ['none', 'monthly', 'yearly'];
const DIRECTIONS: CountdownDirection[] = ['until', 'since', 'auto'];

function normalizeRecurrence(input: unknown): CountdownRecurrence {
  const r = input as { type?: string };
  if (r && RECURRENCE_TYPES.includes(r.type as CountdownRecurrenceType)) {
    return { type: r.type as CountdownRecurrenceType };
  }
  return { type: 'none' };
}

function normalizeEvent(raw: unknown, fallbackId: string): CountdownEvent {
  const input = (raw || {}) as Partial<CountdownEvent> & Record<string, unknown>;
  const now = Date.now();
  const id = typeof input.id === 'string' && input.id ? input.id : fallbackId;
  const targetAt = typeof input.targetAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.targetAt)
    ? input.targetAt
    : new Date(now).toISOString().slice(0, 10);
  const timezone = typeof input.timezone === 'string' && input.timezone ? input.timezone : detectLocalTimezone();
  const targetTime = typeof input.targetTime === 'string' && /^\d{2}:\d{2}$/.test(input.targetTime) ? input.targetTime : undefined;
  const direction = DIRECTIONS.includes(input.direction as CountdownDirection) ? input.direction as CountdownDirection : 'auto';
  return {
    id,
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 200) : '未命名倒數',
    targetAt,
    targetTime,
    timezone,
    direction,
    recurrence: normalizeRecurrence(input.recurrence),
    includeTargetDay: Boolean(input.includeTargetDay),
    showTime: Boolean(input.showTime),
    colorToken: typeof input.colorToken === 'string' ? input.colorToken : undefined,
    iconId: typeof input.iconId === 'string' ? input.iconId : undefined,
    coverAssetId: typeof input.coverAssetId === 'string' ? input.coverAssetId : undefined,
    pinnedToHome: Boolean(input.pinnedToHome),
    homeOrder: Number.isFinite(input.homeOrder) ? Number(input.homeOrder) : undefined,
    createdAt: Number.isFinite(input.createdAt) ? Number(input.createdAt) : now,
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : now,
  };
}

function normalizeWidgetConfig(raw: unknown): CountdownWidgetConfig {
  const input = (raw || {}) as Partial<CountdownWidgetConfig>;
  const size: CountdownWidgetSize = input.size === 'small' || input.size === 'medium' || input.size === 'large'
    ? input.size
    : 'medium';
  const secondary = [0, 1, 2].includes(input.secondaryCount as number) ? input.secondaryCount as 0 | 1 | 2 : 1;
  return {
    size,
    secondaryCount: secondary,
    showBackgroundImage: Boolean(input.showBackgroundImage),
    hideElapsed: Boolean(input.hideElapsed),
    pinnedEventId: typeof input.pinnedEventId === 'string' ? input.pinnedEventId : undefined,
  };
}

function buildEventFromDraft(draft: CountdownEventDraft, id: string, now: number): CountdownEvent {
  return {
    id,
    title: draft.title.trim().slice(0, 200),
    targetAt: draft.targetAt,
    targetTime: draft.targetTime,
    timezone: draft.timezone || detectLocalTimezone(),
    direction: draft.direction,
    recurrence: draft.recurrence,
    includeTargetDay: draft.includeTargetDay,
    showTime: draft.showTime,
    colorToken: draft.colorToken,
    iconId: draft.iconId,
    coverAssetId: draft.coverAssetId,
    pinnedToHome: Boolean(draft.pinnedToHome),
    homeOrder: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export const useCountdownStore = create<CountdownState>()(persist((set, get) => ({
  events: [],
  schemaVersion: SCHEMA_VERSION,
  widgetConfig: { ...DEFAULT_WIDGET_CONFIG },
  _hydrated: false,

  addEvent: (draft) => {
    const id = newCountdownId();
    const now = Date.now();
    set((state) => ({
      events: [buildEventFromDraft(draft, id, now), ...state.events],
    }));
    return id;
  },

  updateEvent: (id, patch) => {
    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== id) return event;
        const next: CountdownEvent = {
          ...event,
          title: patch.title?.trim() ? patch.title.trim().slice(0, 200) : event.title,
          targetAt: patch.targetAt || event.targetAt,
          targetTime: patch.targetTime !== undefined ? patch.targetTime : event.targetTime,
          timezone: patch.timezone || event.timezone,
          direction: patch.direction || event.direction,
          recurrence: patch.recurrence || event.recurrence,
          includeTargetDay: patch.includeTargetDay ?? event.includeTargetDay,
          showTime: patch.showTime ?? event.showTime,
          colorToken: patch.colorToken !== undefined ? patch.colorToken : event.colorToken,
          iconId: patch.iconId !== undefined ? patch.iconId : event.iconId,
          coverAssetId: patch.coverAssetId !== undefined ? patch.coverAssetId : event.coverAssetId,
          pinnedToHome: patch.pinnedToHome ?? event.pinnedToHome,
          updatedAt: Date.now(),
        };
        return next;
      }),
    }));
  },

  deleteEvent: (id) => {
    set((state) => {
      const remaining = state.events.filter((event) => event.id !== id);
      // If the deleted event was the widget's pinned slot, clear it.
      const widgetConfig = state.widgetConfig.pinnedEventId === id
        ? { ...state.widgetConfig, pinnedEventId: undefined }
        : state.widgetConfig;
      return { events: remaining, widgetConfig };
    });
  },

  togglePinnedToHome: (id) => {
    set((state) => {
      const event = state.events.find((e) => e.id === id);
      if (!event) return state;
      const newlyPinned = !event.pinnedToHome;
      return {
        events: state.events.map((e) => e.id === id
          ? { ...e, pinnedToHome: newlyPinned, updatedAt: Date.now() }
          : e),
        // Sync widgetConfig.pinnedEventId — single source of truth for home widget.
        widgetConfig: {
          ...state.widgetConfig,
          pinnedEventId: newlyPinned ? id
            : state.widgetConfig.pinnedEventId === id ? undefined
            : state.widgetConfig.pinnedEventId,
        },
      };
    });
  },

  setHomeOrder: (ids) => {
    const order = new Map(ids.map((id, idx) => [id, idx] as const));
    set((state) => ({
      events: state.events.map((event) => order.has(event.id)
        ? { ...event, homeOrder: order.get(event.id), updatedAt: Date.now() }
        : event),
    }));
  },

  setWidgetConfig: (patch) => {
    set((state) => ({
      widgetConfig: { ...state.widgetConfig, ...patch },
    }));
  },

  pinToWidget: (eventId) => {
    set((state) => ({
      widgetConfig: { ...state.widgetConfig, pinnedEventId: eventId ?? undefined },
    }));
  },
}), {
  name: 'lunartide_countdown_v1',
  version: SCHEMA_VERSION,
  partialize: (state) => ({
    events: state.events,
    schemaVersion: state.schemaVersion,
    widgetConfig: state.widgetConfig,
  }),
  merge: (persisted, current) => {
    const data = persisted as Partial<CountdownState> | undefined;
    const seen = new Set<string>();
    const events = (Array.isArray(data?.events) ? data!.events : []).map((raw) => {
      const fallback = newCountdownId();
      const event = normalizeEvent(raw, fallback);
      if (seen.has(event.id)) {
        return normalizeEvent({ ...(raw as object), id: fallback }, fallback);
      }
      seen.add(event.id);
      return event;
    });
    const widgetConfig = normalizeWidgetConfig(data?.widgetConfig);

    // Migration: if no pinnedEventId but events have pinnedToHome,
    // promote the first pinned event as widgetConfig.pinnedEventId.
    if (!widgetConfig.pinnedEventId) {
      const pinned = events.find((e) => e.pinnedToHome);
      if (pinned) {
        widgetConfig.pinnedEventId = pinned.id;
      }
    }

    return {
      ...current,
      events,
      schemaVersion: SCHEMA_VERSION,
      widgetConfig,
      _hydrated: true,
    };
  },
}));

// Selectors — re-export from canonical selectors module for backward compat.
export {
  selectCountdownEvents,
  selectCountdownWidgetConfig,
  selectCountdownCount,
  selectHydrationState,
} from './countdownSelectors';
