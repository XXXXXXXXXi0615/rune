import { describe, expect, it } from 'vitest';
import { waveformFromChannelData } from './audioWaveform';
import { deterministicWaveform } from './scriptedVoice';

describe('audio waveform decoding (TTS upgrade path)', () => {
  it('derives peaks from real PCM channel data, not from text hashes', () => {
    const channel = new Float32Array(4800);
    for (let index = 0; index < channel.length; index++) {
      const envelope = index < 2400 ? 0.9 : 0.15;
      channel[index] = Math.sin(index / 6) * envelope;
    }
    const waveform = waveformFromChannelData(channel, 64);
    expect(waveform).toHaveLength(64);
    const firstHalfAvg = waveform.slice(0, 32).reduce((sum, value) => sum + value, 0) / 32;
    const secondHalfAvg = waveform.slice(32).reduce((sum, value) => sum + value, 0) / 32;
    expect(firstHalfAvg).toBeGreaterThan(secondHalfAvg * 2);
    expect(waveform).not.toEqual(deterministicWaveform('anything'));
  });

  it('returns an empty waveform for empty channels', () => {
    expect(waveformFromChannelData(new Float32Array(0), 64)).toEqual([]);
  });

  it('normalizes peaks into [0, 1]', () => {
    const channel = new Float32Array([0.1, -2.5, 0.4, 1.2]);
    const waveform = waveformFromChannelData(channel, 4);
    expect(Math.max(...waveform)).toBeLessThanOrEqual(1);
    expect(Math.min(...waveform)).toBeGreaterThanOrEqual(0);
  });
});
