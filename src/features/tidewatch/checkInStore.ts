import { create } from 'zustand';
import type { CheckIn, CheckInActivity } from './types';
import { saveCheckIn, loadLatestCheckIn, loadAllCheckIns } from './repository';
import { emitCheckInActivity } from './activityLedgerStore';
import { toLocalDateString } from '@/utils/date';

/**
 * TIDEWATCH — user check-in store.
 *
 * User self-reporting: activity, mood, energy, focus, note.
 * Mood/energy/focus never inferred from messages, mouse, camera, etc.
 *
 * Latest state exposes age: "updated Xm ago".
 * Never present stale state as certain current state.
 */

interface CheckInState {
  latest: CheckIn | null;
  hydrated: boolean;
  checkIns: CheckIn[];
  submitCheckIn: (data: {
    activity: CheckInActivity;
    mood?: number;
    energy?: number;
    focus?: number;
    note?: string;
  }) => Promise<void>;
  updateTodayCheckIn: (patch: Partial<Pick<CheckIn, 'mood' | 'energy' | 'focus'>>) => Promise<CheckIn | undefined>;
  hydrate: () => Promise<void>;
}

let checkInHydrating: Promise<void> | null = null;

export const useCheckInStore = create<CheckInState>((set, get) => ({
  latest: null,
  hydrated: false,
  checkIns: [],

  submitCheckIn: async (data) => {
    const checkin: CheckIn = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...data,
    };
    await saveCheckIn(checkin);
    await emitCheckInActivity(data.activity);
    set((s) => ({
      latest: checkin,
      checkIns: [...s.checkIns, checkin],
    }));
  },

  updateTodayCheckIn: async (patch) => {
    const today = toLocalDateString(new Date());
    const current = [...get().checkIns].filter((item) => toLocalDateString(new Date(item.createdAt)) === today).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!current) return undefined;
    const updated = { ...current, ...patch };
    await saveCheckIn(updated);
    set((state) => ({ latest: state.latest?.id === updated.id ? updated : state.latest, checkIns: state.checkIns.map((item) => item.id === updated.id ? updated : item) }));
    return updated;
  },

  hydrate: async () => {
    if (get().hydrated) return;
    if (checkInHydrating) return checkInHydrating;

    checkInHydrating = (async () => {
      try {
        const [all, latest] = await Promise.all([
          loadLatestCheckIn().then((c) => (c ? [c] : [])),
          loadLatestCheckIn(),
        ]);
        // Load all for the activity ledger display
        const checkIns = await loadAllCheckIns();
        set({
          latest,
          checkIns: checkIns.sort((a, b) => b.createdAt - a.createdAt),
          hydrated: true,
        });
      } catch {
        set({ hydrated: true });
      } finally {
        checkInHydrating = null;
      }
    })();
    return checkInHydrating;
  },
}));

/**
 * Compute human-readable age string for a check-in timestamp.
 * "3m ago", "47m ago", "2h ago", "昨天", "3天前"
 */
export function formatCheckInAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days}天前`;
}
