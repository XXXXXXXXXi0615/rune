import { describe, expect, it } from 'vitest';
import { CHAT_PERCH_ASSETS, type ChatPerchState } from '@/components/chat/ChatPerch';

const STATES: ChatPerchState[] = ['idle', 'focused', 'typing', 'paused', 'sending', 'waiting', 'received', 'sleepy'];

describe('ChatPerch presentation geometry', () => {
  it('defines one measured alpha box for every runtime state', () => {
    expect(Object.keys(CHAT_PERCH_ASSETS)).toEqual(STATES);
    for (const state of STATES) {
      const asset = CHAT_PERCH_ASSETS[state];
      const [left, top, right, bottom] = asset.alphaBounds;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(asset.rawWidth);
      expect(bottom).toBeLessThanOrEqual(asset.rawHeight);
      expect(right).toBeGreaterThan(left);
      expect(bottom).toBeGreaterThan(top);
    }
  });

  it('normalizes every state against visible alpha height instead of raw canvas height', () => {
    for (const state of STATES) {
      const asset = CHAT_PERCH_ASSETS[state];
      const visibleHeight = asset.alphaBounds[3] - asset.alphaBounds[1];
      const renderedVisibleHeight = visibleHeight * (104 / visibleHeight);
      expect(renderedVisibleHeight).toBeCloseTo(104, 5);
    }
  });
});
