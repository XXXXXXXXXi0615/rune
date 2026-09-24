/**
 * Object Lifecycle Memory store.
 *
 * This is NOT an inventory system. It tracks the emotional lifecycle of
 * physical objects: when they entered the user's life, how long they've been
 * in use, whether they're aging out, and when they were retired.
 *
 * Counts in the Dashboard represent lifecycle states (active / aging /
 * farewell / retired), not stock quantities. There is no restock logic.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ObjectLifecycleEmotion,
  ObjectLifecycleEvent,
  ObjectLifecycleState,
  ObjectMemory,
  ObjectUsageLog,
} from '@/types';

/* ── Lifecycle helpers ── */

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFECYCLE_ORDER: ObjectLifecycleState[] = ['active', 'aging', 'farewell', 'retired'];
const LIFECYCLE_LABEL: Record<ObjectLifecycleState, string> = {
  active: '使用中',
  aging: '漸老',
  farewell: '告別期',
  retired: '已退役',
};

type LegacyLifecycleState = ObjectLifecycleState | 'ending' | 'replaced';

function genId(): string {
  try { return crypto.randomUUID(); } catch { return `obj-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSeedObjectId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith('seed-');
}

export function normalizeLifecycleState(value: unknown): ObjectLifecycleState {
  if (value === 'ending') return 'farewell';
  if (value === 'replaced') return 'retired';
  if (value === 'active' || value === 'aging' || value === 'farewell' || value === 'retired') return value;
  return 'active';
}

function normalizeLifecycleEmotion(value: unknown): ObjectLifecycleEmotion {
  if (
    value === 'neutral' ||
    value === 'warm' ||
    value === 'fond' ||
    value === 'bittersweet' ||
    value === 'grateful' ||
    value === 'sad' ||
    value === 'ready'
  ) {
    return value;
  }
  return 'neutral';
}

/** Compute usage days between a start date and today (or end date). */
export function computeUsageDays(start: string, end?: string): number {
  const s = new Date(start).getTime();
  if (!Number.isFinite(s)) return 0;
  const e = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(e) || e < s) return 0;
  return Math.max(0, Math.floor((e - s) / DAY_MS));
}

/** Suggest a lifecycle state based on usage days. Active < 365, aging < 730,
 * farewell >= 730, retired is manual-only. This is advisory; explicit store
 * actions remain the source of truth. */
export function suggestLifecycleState(start: string, end?: string): ObjectLifecycleState {
  if (end) return 'retired';
  const days = computeUsageDays(start);
  if (days >= 730) return 'farewell';
  if (days >= 365) return 'aging';
  return 'active';
}

function getLifecycleNarrative(
  objectName: string,
  to: ObjectLifecycleState,
  action: ObjectLifecycleEvent['action'],
  from?: ObjectLifecycleState,
  note?: string,
): Pick<ObjectLifecycleEvent, 'reason' | 'emotion' | 'context' | 'note'> {
  if (action === 'edited') {
    return {
      reason: from ? `生命週期從「${LIFECYCLE_LABEL[from]}」被修正為「${LIFECYCLE_LABEL[to]}」` : `生命週期被修正為「${LIFECYCLE_LABEL[to]}」`,
      emotion: 'neutral',
      context: '手動整理',
      note: note || `${objectName} 的生命狀態被重新整理。`,
    };
  }

  if (to === 'aging') {
    return {
      reason: '使用時間累積，開始進入磨合與老化期',
      emotion: 'fond',
      context: '日常陪伴',
      note: note || `${objectName} 已經陪伴了一段時間，使用痕跡開始變得清楚。`,
    };
  }

  if (to === 'farewell') {
    return {
      reason: '物品狀況或陪伴階段正在接近告別',
      emotion: 'bittersweet',
      context: '告別準備',
      note: note || `${objectName} 進入告別期，月潮會替你留住這段陪伴。`,
    };
  }

  if (to === 'retired') {
    return {
      reason: '這段陪伴已完成，物品被正式退役',
      emotion: 'grateful',
      context: '退役歸檔',
      note: note || `${objectName} 已退役，但它留下的日子仍然被保存。`,
    };
  }

  return {
    reason: '重新確認仍在使用',
    emotion: 'warm',
    context: '回到日常',
    note: note || `${objectName} 仍在日常裡被使用。`,
  };
}

function createLifecycleEvent(
  objectId: string,
  objectName: string,
  to: ObjectLifecycleState,
  action: ObjectLifecycleEvent['action'],
  from?: ObjectLifecycleState,
  note?: string,
): ObjectLifecycleEvent {
  const narrative = getLifecycleNarrative(objectName, to, action, from, note);
  return {
    id: genId(),
    objectId,
    from,
    to,
    action,
    ...narrative,
    createdAt: Date.now(),
  };
}

function createRecordNarrativeEvent(object: ObjectMemory, log: Omit<ObjectUsageLog, 'id'>): ObjectLifecycleEvent {
  const moodToEmotion: Record<string, ObjectLifecycleEmotion> = {
    warm: 'warm',
    neutral: 'neutral',
    tired: 'sad',
    fond: 'fond',
    bittersweet: 'bittersweet',
  };

  return {
    id: genId(),
    objectId: object.id,
    to: object.lifecycleState,
    action: 'edited',
    reason: '新增生命記錄',
    emotion: log.mood ? (moodToEmotion[log.mood] || 'neutral') : 'neutral',
    context: log.date,
    note: log.note,
    createdAt: Date.now(),
  };
}

function normalizeLifecycleEvent(event: Partial<ObjectLifecycleEvent>, objectId: string, objectName = '這件物品'): ObjectLifecycleEvent {
  const to = normalizeLifecycleState(event.to);
  const from = event.from ? normalizeLifecycleState(event.from) : undefined;
  const action = event.action === 'created' || event.action === 'edited' || event.action === 'transitioned'
    ? event.action
    : 'transitioned';
  const fallback = getLifecycleNarrative(objectName, to, action, from, event.note);

  return {
    id: event.id || genId(),
    objectId: event.objectId || objectId,
    from,
    to,
    action,
    reason: event.reason || fallback.reason,
    emotion: normalizeLifecycleEmotion(event.emotion),
    context: event.context || fallback.context,
    note: event.note || fallback.note,
    createdAt: typeof event.createdAt === 'number' ? event.createdAt : Date.now(),
  };
}

function normalizeObject(input: ObjectMemory): ObjectMemory {
  const lifecycleState = normalizeLifecycleState(input.lifecycleState);
  const createdAt = typeof input.createdAt === 'number' ? input.createdAt : Date.now();
  const lifecycleEvents = Array.isArray(input.lifecycleEvents) && input.lifecycleEvents.length > 0
    ? input.lifecycleEvents
        .map((event) => normalizeLifecycleEvent(event, input.id, input.name || '這件物品'))
        .filter((event) => event.action !== 'created')
    : [];

  const endDate = lifecycleState === 'retired' ? input.endDate : undefined;

  return {
    ...input,
    lifecycleState,
    endDate,
    usageDays: computeUsageDays(input.startDate, endDate),
    usageLogs: Array.isArray(input.usageLogs) ? input.usageLogs : [],
    lifecycleEvents,
    createdAt,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : createdAt,
  };
}

/** Recompute usageDays for all objects. Called on store init + on tick. */
function recomputeAll(objects: ObjectMemory[]): ObjectMemory[] {
  return objects.filter((object) => !isSeedObjectId(object.id)).map((object) => {
    const normalized = normalizeObject(object);
    return {
      ...normalized,
      usageDays: computeUsageDays(normalized.startDate, normalized.endDate),
    };
  });
}

function applyLifecycleTransition(
  object: ObjectMemory,
  targetState: LegacyLifecycleState,
  action: ObjectLifecycleEvent['action'] = 'transitioned',
  note?: string,
  allowBackward = false,
): { object: ObjectMemory; events: ObjectLifecycleEvent[] } {
  const normalized = normalizeObject(object);
  const current = normalized.lifecycleState;
  const target = normalizeLifecycleState(targetState);

  if (current === target) {
    return { object: normalized, events: [] };
  }

  const currentIndex = LIFECYCLE_ORDER.indexOf(current);
  const targetIndex = LIFECYCLE_ORDER.indexOf(target);
  if (targetIndex < currentIndex && !allowBackward) {
    return { object: normalized, events: [] };
  }

  const forwardStates = targetIndex > currentIndex
    ? LIFECYCLE_ORDER.slice(currentIndex + 1, targetIndex + 1)
    : [target];

  let from = current;
  const events = forwardStates.map((to) => {
    const event = createLifecycleEvent(normalized.id, normalized.name, to, action, from, note);
    from = to;
    return event;
  });

  const nextEndDate = target === 'retired' ? (normalized.endDate || todayIso()) : undefined;
  const nextObject: ObjectMemory = {
    ...normalized,
    lifecycleState: target,
    endDate: nextEndDate,
    usageDays: computeUsageDays(normalized.startDate, nextEndDate),
    lifecycleEvents: [...normalized.lifecycleEvents, ...events],
    updatedAt: Date.now(),
  };

  return { object: nextObject, events };
}

function normalizeStoreEvents(events: ObjectLifecycleEvent[] | undefined, objects: ObjectMemory[]): ObjectLifecycleEvent[] {
  const objectEvents = objects.flatMap((object) => object.lifecycleEvents);
  const objectNameById = new Map(objects.map((object) => [object.id, object.name]));
  const source = Array.isArray(events) && events.length > 0 ? events : objectEvents;
  return source
    .filter((event) => !isSeedObjectId(event.objectId) && objectNameById.has(event.objectId))
    .map((event) => normalizeLifecycleEvent(event, event.objectId, objectNameById.get(event.objectId) || '這件物品'))
    .filter((event) => event.action !== 'created')
    .sort((a, b) => a.createdAt - b.createdAt);
}

/* ── Store ── */
interface ObjectMemoryState {
  objects: ObjectMemory[];
  lifecycleEvents: ObjectLifecycleEvent[];
}

interface ObjectMemoryActions {
  addObject: (input: Omit<ObjectMemory, 'id' | 'usageDays' | 'usageLogs' | 'lifecycleEvents' | 'createdAt' | 'updatedAt'> & { usageLogs?: ObjectUsageLog[] }) => string;
  updateObject: (id: string, patch: Partial<ObjectMemory>) => void;
  deleteObject: (id: string) => void;
  transitionLifecycle: (id: string, state: ObjectLifecycleState, note?: string) => void;
  markActive: (id: string) => void;
  markAging: (id: string) => void;
  markFarewell: (id: string) => void;
  markRetired: (id: string) => void;
  /** Backward-compatible alias for legacy UI callers. */
  setState: (id: string, state: ObjectLifecycleState) => void;
  addUsageLog: (id: string, log: Omit<ObjectUsageLog, 'id'>) => void;
  removeUsageLog: (id: string, logId: string) => void;
  /** Recompute usageDays for all objects (call once per session). */
  refreshUsageDays: () => void;
  getById: (id: string) => ObjectMemory | undefined;
}

type ObjectMemoryStore = ObjectMemoryState & ObjectMemoryActions;

export const useObjectMemoryStore = create<ObjectMemoryStore>()(
  persist(
    (set, get) => ({
      objects: [],
      lifecycleEvents: [],

      addObject: (input) => {
        const id = genId();
        const now = Date.now();
        const lifecycleState = normalizeLifecycleState(input.lifecycleState);
        const endDate = lifecycleState === 'retired' ? (input.endDate || todayIso()) : undefined;
        const obj: ObjectMemory = {
          id,
          name: input.name.trim(),
          image: input.image,
          category: input.category.trim(),
          lifecycleState,
          startDate: input.startDate,
          endDate,
          notes: input.notes || '',
          usageDays: computeUsageDays(input.startDate, endDate),
          usageLogs: input.usageLogs ?? [],
          lifecycleEvents: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          objects: [obj, ...s.objects],
          lifecycleEvents: s.lifecycleEvents,
        }));
        return id;
      },

      updateObject: (id, patch) => {
        const desiredState = patch.lifecycleState;
        const { lifecycleState: _state, lifecycleEvents: _events, ...restPatch } = patch;

        set((s) => {
          const createdEvents: ObjectLifecycleEvent[] = [];
          const objects = s.objects.map((object) => {
            if (object.id !== id) return object;
            const normalized = normalizeObject(object);
            const nextBase = normalizeObject({
              ...normalized,
              ...restPatch,
              updatedAt: Date.now(),
            });

            const target = desiredState ? normalizeLifecycleState(desiredState) : nextBase.lifecycleState;
            const transitioned = target !== nextBase.lifecycleState
              ? applyLifecycleTransition(nextBase, target, 'edited', undefined, true)
              : { object: nextBase, events: [] };
            if (target === 'retired' && restPatch.endDate) {
              transitioned.object.endDate = restPatch.endDate;
              transitioned.object.usageDays = computeUsageDays(transitioned.object.startDate, restPatch.endDate);
            }

            createdEvents.push(...transitioned.events);
            return transitioned.object;
          });

          return {
            objects,
            lifecycleEvents: createdEvents.length > 0
              ? [...s.lifecycleEvents, ...createdEvents]
              : s.lifecycleEvents,
          };
        });
      },

      deleteObject: (id) => {
        set((s) => ({
          objects: s.objects.filter((o) => o.id !== id),
          lifecycleEvents: s.lifecycleEvents.filter((event) => event.objectId !== id),
        }));
      },

      transitionLifecycle: (id, state, note) => {
        set((s) => {
          const createdEvents: ObjectLifecycleEvent[] = [];
          const objects = s.objects.map((object) => {
            if (object.id !== id) return object;
            const result = applyLifecycleTransition(object, state, 'transitioned', note);
            createdEvents.push(...result.events);
            return result.object;
          });

          return {
            objects,
            lifecycleEvents: createdEvents.length > 0
              ? [...s.lifecycleEvents, ...createdEvents]
              : s.lifecycleEvents,
          };
        });
      },

      markActive: (id) => get().transitionLifecycle(id, 'active'),
      markAging: (id) => get().transitionLifecycle(id, 'aging'),
      markFarewell: (id) => get().transitionLifecycle(id, 'farewell'),
      markRetired: (id) => get().transitionLifecycle(id, 'retired'),
      setState: (id, state) => get().transitionLifecycle(id, state),

      addUsageLog: (id, log) => {
        const logId = genId();
        set((s) => {
          const createdEvents: ObjectLifecycleEvent[] = [];
          const objects = s.objects.map((o) => {
            if (o.id !== id) return o;
            const event = createRecordNarrativeEvent(o, log);
            createdEvents.push(event);
            return {
              ...o,
              usageLogs: [...o.usageLogs, { ...log, id: logId }],
              lifecycleEvents: [...o.lifecycleEvents, event],
              updatedAt: Date.now(),
            };
          });
          return {
            objects,
            lifecycleEvents: createdEvents.length > 0
              ? [...s.lifecycleEvents, ...createdEvents]
              : s.lifecycleEvents,
          };
        });
      },

      removeUsageLog: (id, logId) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? { ...o, usageLogs: o.usageLogs.filter((l) => l.id !== logId), updatedAt: Date.now() }
              : o,
          ),
        }));
      },

      refreshUsageDays: () => {
        set((s) => {
          const objects = recomputeAll(s.objects);
          return {
            objects,
            lifecycleEvents: normalizeStoreEvents(s.lifecycleEvents, objects),
          };
        });
      },

      getById: (id) => get().objects.find((o) => o.id === id),
    }),
    {
      name: 'lunartide_object_memory',
      partialize: (state) => ({
        objects: state.objects,
        lifecycleEvents: state.lifecycleEvents,
      }),
      // Recompute usage days and migrate legacy lifecycle states after rehydration.
      onRehydrateStorage: () => (state) => {
        if (state) state.refreshUsageDays();
      },
    },
  ),
);

/* ── Dashboard summary selectors (memoized via simple functions) ── */

export interface ObjectMemorySummary {
  farewell: number;     // state === 'farewell'
  active: number;       // state === 'active'
  aging: number;        // state === 'aging'
  retired: number;      // state === 'retired'
  total: number;
}

export function getSummary(objects: ObjectMemory[]): ObjectMemorySummary {
  const s = { farewell: 0, active: 0, aging: 0, retired: 0, total: objects.length };
  for (const object of objects) {
    const state = normalizeLifecycleState(object.lifecycleState);
    if (state === 'farewell') s.farewell++;
    if (state === 'active') s.active++;
    if (state === 'aging') s.aging++;
    if (state === 'retired') s.retired++;
  }
  return s;
}
