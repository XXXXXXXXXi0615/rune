import { beforeEach, describe, expect, it } from 'vitest';
import { adaptModelEmotion, runtimeEmotionSignal, validateEmotionSignal } from './ModelEmotionAdapter';
import { usePetEmotionStore } from '@/store/usePetEmotionStore';

describe('ModelEmotionAdapter', () => {
  beforeEach(() => usePetEmotionStore.getState().resetTransient());
  it('validates and clamps the public emotion schema', () => { const value = validateEmotionSignal({ primary: 'joy', secondary: 'curious', valence: 9, arousal: -2, intensity: 2, confidence: .8, ttlMs: 4, publicCue: '情'.repeat(80), reasoning: 'secret' }, 'model', 10); expect(value).toMatchObject({ primary: 'joy', secondary: 'curious', valence: 1, arousal: 0, intensity: 1, confidence: .8, ttlMs: 1500, createdAt: 10 }); expect(value.publicCue).toHaveLength(60); expect(value).not.toHaveProperty('reasoning'); });
  it('falls back safely for invalid emotions', () => expect(validateEmotionSignal({ primary: 'angry' }).primary).toBe('neutral'));
  it('removes a restricted envelope from visible chat content', () => { const result = adaptModelEmotion({ content: '可見回答\n<emotion>{"primary":"focused","valence":0,"arousal":0.5,"intensity":0.7,"confidence":0.9,"ttlMs":5000}</emotion>' }, 20); expect(result.cleanContent).toBe('可見回答'); expect(result.signal.primary).toBe('focused'); });
  it('maps runtime lifecycle without a second request', () => { expect(runtimeEmotionSignal('generating').primary).toBe('focused'); expect(runtimeEmotionSignal('tool-call').secondary).toBe('curious'); expect(runtimeEmotionSignal('error').primary).toBe('concerned'); });
  it('smooths confidence, display time, switch rate and ttl', () => { const now = Date.now() + 2_000; const store = usePetEmotionStore.getState(); expect(store.applySignal({ ...runtimeEmotionSignal('success', now), confidence: .95 })).toBe(true); expect(store.applySignal({ ...runtimeEmotionSignal('error', now + 200), confidence: .2 })).toBe(false); usePetEmotionStore.getState().expire(now + 5_000); expect(usePetEmotionStore.getState().signal.primary).toBe('neutral'); });
});
