import { WAVEFORM_PEAK_COUNT } from '@/utils/voiceMessage';

/**
 * Compute a normalized waveform from real decoded PCM channel data.
 * Used for the TTS upgrade path — never derived from text hashes.
 */
export function waveformFromChannelData(channel: Float32Array, count = WAVEFORM_PEAK_COUNT): number[] {
  if (!channel.length || count <= 0) return [];
  const peaks: number[] = [];
  for (let index = 0; index < count; index++) {
    const start = Math.floor((index * channel.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * channel.length) / count));
    let max = 0;
    for (let cursor = start; cursor < end && cursor < channel.length; cursor++) {
      const value = Math.abs(channel[cursor]);
      if (Number.isFinite(value) && value > max) max = value;
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 0.0001);
  return peaks.map((value) => Math.round(Math.min(1, value / top) * 1000) / 1000);
}

export interface DecodedAudioSummary {
  durationMs: number;
  waveform: number[];
}

/** Decode an audio Blob and extract its real duration + waveform. */
export async function decodeBlobWaveform(blob: Blob, count = WAVEFORM_PEAK_COUNT): Promise<DecodedAudioSummary> {
  const AudioContextCtor: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioContextCtor) throw new Error('AudioContext unavailable');
  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return {
      durationMs: Math.round(buffer.duration * 1000),
      waveform: waveformFromChannelData(buffer.getChannelData(0), count),
    };
  } finally {
    void context.close().catch(() => undefined);
  }
}
