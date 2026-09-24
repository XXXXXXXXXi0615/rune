import { describe, expect, it } from 'vitest';
import { normalizeStore } from '@/store/storage';
import type { AppData } from '@/types';

describe('CalendarEntry legacy migration', () => {
  it('absorbs legacy timeEvents into customEvents without retaining a second entity collection', () => {
    const normalized = normalizeStore({
      customEvents: [{ id: 'event-1', type: 'event', date: '2026-08-31', title: '既有日程', completed: false, description: '', isAllDay: true }],
      timeEvents: [{ id: 'time-1', title: '生日', date: '2026-09-01', type: 'birthday', repeat: 'yearly', icon: 'moon', note: '帶禮物', pinned: true, reminderEnabled: false, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
    } as Partial<AppData>);

    expect(normalized.timeEvents).toEqual([]);
    expect(normalized.customEvents).toHaveLength(2);
    expect(normalized.customEvents.find((entry) => entry.id === 'time-1')).toMatchObject({
      type: 'event', date: '2026-09-01', title: '生日', category: 'birthday', eventType: 'birthday',
      note: '帶禮物', description: '帶禮物', isAllDay: true, repeat: 'yearly', pinned: true,
    });
  });

  it('does not duplicate an already migrated legacy id', () => {
    const normalized = normalizeStore({
      customEvents: [{ id: 'same', type: 'event', date: '2026-08-31', title: 'canonical', completed: false, description: '', isAllDay: true }],
      timeEvents: [{ id: 'same', title: 'legacy', date: '2026-08-31', type: 'personal', repeat: 'none', icon: 'moon', pinned: false, reminderEnabled: false, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }],
    } as Partial<AppData>);
    expect(normalized.customEvents.filter((entry) => entry.id === 'same')).toHaveLength(1);
    expect(normalized.customEvents[0].title).toBe('canonical');
  });
});
