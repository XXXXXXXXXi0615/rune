import { describe, expect, it } from 'vitest';
import { mapTodayMoodToPetMood, resolvePetState } from '@/features/pet/petController';

const base = {
  tideboundStatus: 'idle' as const,
  tideboundResult: null,
  interaction: null,
  controlMode: 'follow' as const,
  manualEmotion: 'calm' as const,
  manualAction: 'idle' as const,
  timeOfDay: 12,
};

describe('resolvePetState', () => {
  it('maps user mood without letting UI choose frames', () => {
    expect(resolvePetState({ ...base, userMood: 'good' }).animationId).toBe('idle-happy');
    expect(resolvePetState({ ...base, userMood: 'neutral' }).animationId).toBe('idle-calm');
    expect(resolvePetState({ ...base, userMood: 'bad' }).animationId).toBe('idle-sad');
  });

  it('gives active TIDEBOUND state priority over manual and mood', () => {
    const state = resolvePetState({
      ...base,
      tideboundStatus: 'running',
      controlMode: 'manual',
      manualEmotion: 'sad',
      manualAction: 'cry',
      userMood: 'bad',
    });
    expect(state).toMatchObject({ action: 'work', source: 'tidebound', animationId: 'work-calm' });
  });

  it('gives transient interaction the highest priority', () => {
    const state = resolvePetState({ ...base, tideboundStatus: 'running', interaction: 'encourage', interactionExpiresAt: 42 });
    expect(state).toMatchObject({ emotion: 'happy', action: 'cheer', source: 'interaction', expiresAt: 42 });
  });

  it('keeps manual state isolated from mood', () => {
    const state = resolvePetState({ ...base, controlMode: 'manual', manualEmotion: 'tired', manualAction: 'sleep', userMood: 'good' });
    expect(state).toMatchObject({ emotion: 'tired', action: 'sleep', source: 'manual' });
  });

  it('maps rest, sleep, completion and interruption semantically', () => {
    expect(resolvePetState({ ...base, tideboundStatus: 'break' }).action).toBe('rest');
    expect(resolvePetState({ ...base, tideboundStatus: 'sleeping' }).action).toBe('sleep');
    expect(resolvePetState({ ...base, tideboundResult: 'completed' }).action).toBe('cheer');
    expect(resolvePetState({ ...base, tideboundResult: 'interrupted' }).emotion).toBe('tired');
    expect(resolvePetState({ ...base, tideboundResult: 'abandoned' }).emotion).toBe('sad');
  });

  it('returns to the latest session state after a transient interaction', () => {
    const duringInteraction = resolvePetState({ ...base, tideboundStatus: 'running', interaction: 'pet' });
    const afterInteraction = resolvePetState({ ...base, tideboundStatus: 'break', interaction: null });
    expect(duringInteraction.source).toBe('interaction');
    expect(afterInteraction).toMatchObject({ source: 'tidebound', action: 'rest', animationId: 'rest-calm' });
  });
});

describe('mapTodayMoodToPetMood', () => {
  it('normalizes the existing app mood vocabulary', () => {
    expect(mapTodayMoodToPetMood('happy')).toBe('good');
    expect(mapTodayMoodToPetMood('calm')).toBe('neutral');
    expect(mapTodayMoodToPetMood('gloomy')).toBe('bad');
    expect(mapTodayMoodToPetMood(null)).toBeNull();
  });
});
