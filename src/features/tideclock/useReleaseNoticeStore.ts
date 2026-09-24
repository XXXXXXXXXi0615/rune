import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReleaseNotice } from '@/config/releaseNotices';
import { RELEASE_NOTICES, getLatestUnreadNotice, noticeId } from '@/config/releaseNotices';

const STORAGE_KEY = 'lunartide-release-notices';

interface ReleaseNoticeState {
  notices: ReleaseNotice[];
  markRead: (version: string) => void;
  dismissToday: (version: string) => void;
  getLatestUnread: () => ReleaseNotice | undefined;
  hasUnread: () => boolean;
  ensureNotices: () => void;
}

function seedNotices(): ReleaseNotice[] {
  return RELEASE_NOTICES.map((n) => ({ ...n }));
}

function tomorrowStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export const useReleaseNoticeStore = create<ReleaseNoticeState>()(
  persist(
    (set, get) => ({
      notices: [],

      ensureNotices: () => {
        const state = get();
        const existingIds = new Set(state.notices.map((n) => n.id));
        const fresh = seedNotices();
        const merged = fresh.map((n) => {
          const existing = state.notices.find((e) => e.id === n.id);
          if (existing) return existing;
          return n;
        });
        const newNotices = fresh.filter((n) => !existingIds.has(n.id));
        if (newNotices.length > 0) {
          set({ notices: merged });
        } else if (state.notices.length === 0) {
          set({ notices: merged });
        }
      },

      markRead: (version: string) => {
        const nid = noticeId(version);
        set((s) => ({
          notices: s.notices.map((n) =>
            n.id === nid ? { ...n, readAt: Date.now() } : n,
          ),
        }));
      },

      dismissToday: (version: string) => {
        const nid = noticeId(version);
        const until = tomorrowStart();
        set((s) => ({
          notices: s.notices.map((n) =>
            n.id === nid ? { ...n, dismissedUntil: until } : n,
          ),
        }));
      },

      getLatestUnread: () => {
        const state = get();
        return getLatestUnreadNotice(state.notices);
      },

      hasUnread: () => {
        const state = get();
        return !!getLatestUnreadNotice(state.notices);
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
    },
  ),
);
