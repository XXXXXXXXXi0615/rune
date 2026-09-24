import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { executeCalendarTool, markCalendarChangesSeen, toggleCalendarNoteLike, undoCalendarDelete } from './calendarToolAdapter';

const allowed = { read: true, create: true, update: true, delete: true, comment: true };

beforeEach(() => {
  useAppStore.setState({ customEvents: [], calendarNotes: [], calendarChanges: [], calendarPermissions: allowed, lastSeenCalendarRevision: 0 });
});

describe('CalendarToolAdapter', () => {
  it('keeps user events canonical while LUNARIS list and see can read them', () => {
    useAppStore.getState().addCalendarEvent({ type: 'event', date: '2026-08-09', title: 'USER 安排', completed: false, description: '', isAllDay: true });
    expect(useAppStore.getState().customEvents[0].author).toBe('user');
    const list = executeCalendarTool({ action: 'list', from: '2026-08-09', to: '2026-08-09' });
    const see = executeCalendarTool({ action: 'see', date: '2026-08-09' });
    expect(list.ok && 'events' in list && list.events[0].title).toBe('USER 安排');
    expect(see.ok && 'events' in see ? see.events : []).toHaveLength(1);
  });

  it('creates LUNARIS events with authorship and optional quest reference only', () => {
    const result = executeCalendarTool({ action: 'create', title: '共同散步', startsAt: '2026-08-09T15:00:00+08:00', endsAt: '2026-08-09T16:00:00+08:00', questId: 'quest-1' });
    expect(result.ok && 'event' in result && result.event).toMatchObject({ author: 'lunaris', questId: 'quest-1', title: '共同散步' });
    expect(useAppStore.getState().customEvents[0]).not.toHaveProperty('quest');
  });

  it('comments, persists likes and enforces the three-note daily budget', () => {
    const notes = [1, 2, 3].map((n) => executeCalendarTool({ action: 'comment', date: '2026-08-09', content: `便簽 ${n}` }));
    expect(notes.every((result) => result.ok)).toBe(true);
    expect(executeCalendarTool({ action: 'comment', date: '2026-08-09', content: '第四張' })).toMatchObject({ ok: false, code: 'budget_exceeded' });
    const noteId = useAppStore.getState().calendarNotes![0].id;
    expect(toggleCalendarNoteLike(noteId, 'user')).toBe(true);
    expect(useAppStore.getState().calendarNotes![0].likedByUser).toBe(true);
  });

  it('lets LUNARIS update and soft-delete only its own notes', () => {
    const created = executeCalendarTool({ action: 'comment', date: '2026-08-09', content: '原文' });
    if (!created.ok || !('note' in created) || !created.note) throw new Error('fixture note failed');
    expect(executeCalendarTool({ action: 'update', noteId: created.note.id, content: '改過的便簽' })).toMatchObject({ ok: true, note: { content: '改過的便簽' } });
    expect(executeCalendarTool({ action: 'delete', noteId: created.note.id })).toMatchObject({ ok: true, note: { id: created.note.id } });
    expect(useAppStore.getState().calendarNotes![0].deletedAt).toBeTruthy();
  });

  it('newChanges advances by cursor without deleting history', () => {
    useAppStore.getState().addCalendarEvent({ type: 'event', date: '2026-08-09', title: '改動', completed: false, description: '', isAllDay: true });
    const first = executeCalendarTool({ action: 'list', date: '2026-08-09', newOnly: true });
    expect(first.ok && 'newChanges' in first ? first.newChanges : []).toHaveLength(1);
    const before = useAppStore.getState().calendarChanges!.length;
    if (first.ok) markCalendarChangesSeen(first.revision);
    const second = executeCalendarTool({ action: 'list', date: '2026-08-09', newOnly: true });
    expect(second.ok && 'newChanges' in second ? second.newChanges : []).toHaveLength(0);
    expect(useAppStore.getState().calendarChanges).toHaveLength(before);
  });

  it('denies writes by default permission and refuses revision conflicts', () => {
    useAppStore.setState({ calendarPermissions: { read: true, create: false, update: false, delete: false, comment: true } });
    expect(executeCalendarTool({ action: 'create', title: '拒絕', startsAt: '2026-08-09' })).toMatchObject({ ok: false, code: 'permission_denied' });
    useAppStore.setState({ calendarPermissions: allowed });
    const created = executeCalendarTool({ action: 'create', title: '可建立', startsAt: '2026-08-09' });
    if (!created.ok || !('event' in created) || !created.event) throw new Error('fixture create failed');
    expect(executeCalendarTool({ action: 'update', eventId: created.event.id, title: '盲寫', expectedRevision: 99 })).toMatchObject({ ok: false, code: 'conflict' });
    useAppStore.setState({ calendarPermissions: { ...allowed, delete: false } });
    expect(executeCalendarTool({ action: 'delete', eventId: created.event.id, expectedRevision: 1 })).toMatchObject({ ok: false, code: 'permission_denied' });
  });

  it('soft deletes and supports undo without losing the event', () => {
    const created = executeCalendarTool({ action: 'create', title: '可復原', startsAt: '2026-08-09' });
    if (!created.ok || !('event' in created) || !created.event) throw new Error('fixture create failed');
    const deleted = executeCalendarTool({ action: 'delete', eventId: created.event.id, expectedRevision: 1 });
    expect(deleted.ok && 'event' in deleted && deleted.event?.deletedAt).toBeTruthy();
    expect(useAppStore.getState().customEvents).toHaveLength(1);
    expect(undoCalendarDelete(created.event.id)).toBe(true);
    expect(useAppStore.getState().customEvents[0].deletedAt).toBeUndefined();
  });
});
