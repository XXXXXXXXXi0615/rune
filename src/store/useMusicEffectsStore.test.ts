import { beforeEach, describe, expect, it } from 'vitest';
import { MUSIC_EFFECT_PRESETS, useMusicEffectsStore } from './useMusicEffectsStore';

describe('music effects presets', () => {
  beforeEach(() => useMusicEffectsStore.setState({
    ...MUSIC_EFFECT_PRESETS.flat,
    preset: 'flat',
    scope: 'session',
    customPreset: undefined,
    globalDefault: undefined,
    trackOverrides: {},
    playlistOverrides: {},
  }));

  it('keeps the flat preset at zero dB', () => {
    const flat = MUSIC_EFFECT_PRESETS.flat;
    expect([flat.preamp, flat.low, flat.lowMid, flat.mid, flat.highMid, flat.high]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('applies deterministic preset values', () => {
    useMusicEffectsStore.getState().applyPreset('warm');
    const state = useMusicEffectsStore.getState();
    expect(state.preset).toBe('warm');
    expect(state.lowMid).toBe(3);
    expect(state.high).toBe(-2);
  });

  it('switches to custom after manual adjustment', () => {
    useMusicEffectsStore.getState().applyPreset('vocal');
    useMusicEffectsStore.getState().setParameter('mid', 4);
    expect(useMusicEffectsStore.getState().preset).toBe('custom');
    expect(useMusicEffectsStore.getState().mid).toBe(4);
  });

  it('saves and reapplies a custom preset', () => {
    useMusicEffectsStore.getState().setParameter('mid', 4.5);
    useMusicEffectsStore.getState().saveCurrent('track-a');
    useMusicEffectsStore.getState().applyPreset('flat');
    useMusicEffectsStore.getState().applyCustomPreset();
    expect(useMusicEffectsStore.getState().mid).toBe(4.5);
  });

  it('resolves track overrides before playlist and global defaults', () => {
    useMusicEffectsStore.setState({
      globalDefault: { ...MUSIC_EFFECT_PRESETS.flat, low: 1 },
      playlistOverrides: { 'playlist-a': { ...MUSIC_EFFECT_PRESETS.flat, low: 2 } },
      trackOverrides: { 'track-a': { ...MUSIC_EFFECT_PRESETS.flat, low: 3 } },
    });
    useMusicEffectsStore.getState().loadResolvedForContext('track-a', 'playlist-a');
    expect(useMusicEffectsStore.getState().low).toBe(3);
    useMusicEffectsStore.getState().loadResolvedForContext('track-b', 'playlist-a');
    expect(useMusicEffectsStore.getState().low).toBe(2);
    useMusicEffectsStore.getState().loadResolvedForContext('track-b');
    expect(useMusicEffectsStore.getState().low).toBe(1);
  });
});
