import { beforeEach, describe, expect, it } from 'vitest';
import { usePresenceStore } from '@/store/usePresenceStore';

beforeEach(() => {
  localStorage.clear();
  usePresenceStore.setState({ presences: {}, autoStatusEnabled: true });
});

describe('presence priority and persistence', () => {
  it('keeps manual status above automatic TIDEBOUND status', () => {
    const store = usePresenceStore.getState();
    store.setPresence('self', 'online', '今天會回覆');
    const manualLastActiveAt = usePresenceStore.getState().getPresence('self').lastActiveAt;
    store.setTemporaryPresence('self', 'busy', '專心中');

    const current = usePresenceStore.getState().getPresence('self');
    expect(current.visiblePresenceStatus).toBe('online');
    expect(current.customText).toBe('今天會回覆');
    expect(current.lastActiveAt).toBe(manualLastActiveAt);
  });

  it('allows automatic status to be disabled independently of control mode', () => {
    const store = usePresenceStore.getState();
    store.setAutoStatusEnabled(false);
    store.setTemporaryPresence('lunaris', 'busy');
    expect(usePresenceStore.getState().getPresence('lunaris').visiblePresenceStatus).toBe('offline');
    expect(usePresenceStore.getState().autoStatusEnabled).toBe(false);
  });

  it('does not invent a last-active timestamp for unknown offline members', () => {
    const first = usePresenceStore.getState().getPresence('unknown');
    const second = usePresenceStore.getState().getPresence('unknown');
    expect(first).toBe(second);
    expect(first.lastActiveAt).toBeUndefined();
    expect(second.lastActiveAt).toBeUndefined();
  });

  it('creates one new presence reference for one actual update', () => {
    const fallback = usePresenceStore.getState().getPresence('self');
    usePresenceStore.getState().setPresence('self', 'online');
    const updated = usePresenceStore.getState().getPresence('self');

    expect(updated).not.toBe(fallback);
    expect(usePresenceStore.getState().getPresence('self')).toBe(updated);
  });

  it('clears temporary focus text after returning online', () => {
    const store = usePresenceStore.getState();
    store.setTemporaryPresence('self', 'busy', '專心中');
    store.setTemporaryPresence('self', 'online');
    const current = usePresenceStore.getState().getPresence('self');
    expect(current.visiblePresenceStatus).toBe('online');
    expect(current.customText).toBeUndefined();
  });
});
