import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'lunartide-daily-mood-v1';
const TODAY = '2026-09-28';

async function freshStore() {
  vi.resetModules();
  return (await import('@/store/useDailyMoodStore')).useDailyMoodStore;
}

describe('Daily Mood canonical records', () => {
  beforeEach(() => localStorage.clear());

  it('sets, replaces and toggles the same mood off for one local date', async () => {
    const store = await freshStore();
    store.getState().setMood(TODAY, 'calm');
    expect(store.getState().getMood(TODAY)).toBe('calm');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ [TODAY]: 'calm' });
    store.getState().toggleMood(TODAY, 'sad');
    expect(store.getState().getMood(TODAY)).toBe('sad');
    store.getState().toggleMood(TODAY, 'sad');
    expect(store.getState().getMood(TODAY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({});
  });

  it('reloads persisted values and safely drops invalid entries', async () => {
    localStorage.setItem(KEY, JSON.stringify({ [TODAY]: 'good', '2026-02-30': 'sad', '2026-09-27': 'unknown' }));
    const store = await freshStore();
    expect(store.getState().moods).toEqual({ [TODAY]: 'good' });
    store.getState().setMood('2026-09-29', 'neutral');
    const reloaded = await freshStore();
    expect(reloaded.getState().moods).toEqual({ [TODAY]: 'good', '2026-09-29': 'neutral' });
  });

  it('ignores invalid dates and unknown mood IDs without writing', async () => {
    const store = await freshStore();
    store.getState().setMood('2026-02-30', 'calm');
    store.getState().setMood(TODAY, 'alien' as 'calm');
    store.getState().toggleMood('bad-date', 'sad');
    store.getState().toggleMood(TODAY, 'alien' as 'calm');
    expect(store.getState().moods).toEqual({});
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('starts empty when storage is missing or malformed', async () => {
    expect((await freshStore()).getState().moods).toEqual({});
    localStorage.setItem(KEY, '{bad');
    expect((await freshStore()).getState().moods).toEqual({});
  });

  it('does not touch check-in or global todayMood persistence', async () => {
    const checkIn = '{"legacy":"unchanged"}';
    const app = '{"state":{"todayMood":"happy"},"version":3}';
    localStorage.setItem('lunartide-check-in', checkIn);
    localStorage.setItem('lunartide_data', app);
    const store = await freshStore();
    store.getState().toggleMood(TODAY, 'calm');
    store.getState().toggleMood(TODAY, 'calm');
    expect(localStorage.getItem('lunartide-check-in')).toBe(checkIn);
    expect(localStorage.getItem('lunartide_data')).toBe(app);
  });
});
