export const MIN_VOICE_DURATION_MS = 600;
export const MAX_VOICE_DURATION_MS = 120_000;
export const WAVEFORM_PEAK_COUNT = 64;

export function normalizeWaveform(samples: number[], count = WAVEFORM_PEAK_COUNT): number[] {
  if (!samples.length || count <= 0) return [];
  const peaks: number[] = [];
  for (let index = 0; index < count; index++) {
    const start = Math.floor((index * samples.length) / count);
    const end = Math.max(start + 1, Math.ceil(((index + 1) * samples.length) / count));
    const bucket = samples.slice(start, Math.min(samples.length, end));
    peaks.push(Math.max(...bucket.map((value) => Math.abs(Number.isFinite(value) ? value : 0))));
  }
  const max = Math.max(...peaks, 0.0001);
  return peaks.map((value) => Math.round(Math.min(1, value / max) * 1000) / 1000);
}

export function canSendVoiceDuration(durationMs: number): boolean {
  return durationMs >= MIN_VOICE_DURATION_MS && durationMs <= MAX_VOICE_DURATION_MS;
}

/** Text available for 語音轉文本 — no real ASR, only existing snapshots. */
export function getVoiceMessageText(message: { textSnapshot?: string; transcript?: string }): string {
  return (message.textSnapshot || message.transcript || '').trim();
}
