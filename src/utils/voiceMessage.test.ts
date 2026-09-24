import { describe, expect, it } from 'vitest';
import { canSendVoiceDuration, normalizeWaveform } from './voiceMessage';

describe('voice message helpers', () => {
  it('normalizes waveform to a stable bounded peak count', () => {
    const result = normalizeWaveform([0, 0.5, 2, -1], 64);
    expect(result).toHaveLength(64);
    expect(Math.min(...result)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...result)).toBeLessThanOrEqual(1);
  });

  it('rejects recordings shorter than 600ms', () => {
    expect(canSendVoiceDuration(599)).toBe(false);
    expect(canSendVoiceDuration(600)).toBe(true);
  });
});
