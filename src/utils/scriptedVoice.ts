import type { VoiceMessagePayload, VoiceSnapshot } from '@/types';
import { WAVEFORM_PEAK_COUNT } from '@/utils/voiceMessage';

export const SCRIPTED_MIN_DURATION_MS = 1000;
export const SCRIPTED_MAX_DURATION_MS = 120_000;

/** FNV-1a 32-bit hash — stable across sessions for deterministic waveforms. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic pseudo-waveform for scripted (text-performed) voice messages.
 * Same text + voice key always yields the same peaks, so bubbles stay stable
 * across reloads without persisting audio. NOT used for real audio sources.
 */
export function deterministicWaveform(text: string, voiceKey = '', count = WAVEFORM_PEAK_COUNT): number[] {
  const rand = mulberry32(hashSeed(`${voiceKey}::${text}`));
  const peaks: number[] = [];
  let momentum = 0.45 + rand() * 0.2;
  for (let index = 0; index < count; index++) {
    const jitter = (rand() - 0.5) * 0.5;
    momentum = Math.min(1, Math.max(0.08, momentum + jitter * 0.6));
    const breathDip = index % 16 === 15 ? 0.3 : 1;
    peaks.push(Math.round(Math.min(1, Math.max(0.06, momentum * breathDip)) * 1000) / 1000);
  }
  return peaks;
}

/** Estimate spoken duration from text length. CJK chars ≈ 260ms, latin words ≈ 320ms at rate 1. */
export function estimateScriptedDurationMs(text: string, rate = 1): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cjkCount = (trimmed.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinWords = trimmed
    .replace(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const pauses = (trimmed.match(/[，。！？,.!?;；\n]/g) || []).length;
  const baseMs = cjkCount * 260 + latinWords * 320 + pauses * 220;
  const safeRate = Math.min(2, Math.max(0.5, rate || 1));
  return Math.min(SCRIPTED_MAX_DURATION_MS, Math.max(SCRIPTED_MIN_DURATION_MS, Math.round(baseMs / safeRate)));
}

/** Split text into caption segments for the no-SpeechSynthesis fallback. */
export function splitCaptionSegments(text: string): string[] {
  const segments = text
    .split(/(?<=[，。！？,.!?;；\n])/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length ? segments : [text.trim()].filter(Boolean);
}

export interface ScriptedVoiceInput {
  text: string;
  tone?: string;
  rate?: number;
  pitch?: number;
  voiceName?: string;
  voiceUri?: string;
  lang?: string;
}

/**
 * Build a scripted voice payload. Never creates an audioAssetId — scripted
 * messages carry no audio and must not masquerade as real recordings.
 */
export function buildScriptedVoicePayload(input: ScriptedVoiceInput): VoiceMessagePayload {
  const text = input.text.trim();
  if (!text) throw new Error('scripted voice requires text');
  const voiceSnapshot: VoiceSnapshot = {
    voiceName: input.voiceName,
    voiceUri: input.voiceUri,
    tone: input.tone,
    rate: input.rate ?? 1,
    pitch: input.pitch,
    lang: input.lang,
  };
  return {
    source: 'scripted',
    textSnapshot: text,
    durationMs: estimateScriptedDurationMs(text, voiceSnapshot.rate),
    waveform: deterministicWaveform(text, `${voiceSnapshot.voiceUri || voiceSnapshot.voiceName || ''}@${voiceSnapshot.rate}`),
    voiceSnapshot,
  };
}

export interface RecordedVoiceInput {
  audioAssetId: string;
  durationMs: number;
  waveform: number[];
  mimeType: string;
  transcript?: string;
}

/** Build a recorded voice payload — a real microphone capture with a real asset. */
export function buildRecordedVoicePayload(input: RecordedVoiceInput): VoiceMessagePayload {
  if (!input.audioAssetId) throw new Error('recorded voice requires an audio asset');
  return {
    source: 'recorded',
    audioAssetId: input.audioAssetId,
    durationMs: input.durationMs,
    waveform: input.waveform,
    mimeType: input.mimeType,
    transcript: input.transcript,
  };
}

export interface TtsVoiceInput {
  audioAssetId: string;
  durationMs: number;
  /** Must come from decoding the real synthesized audio — never a text-hash waveform. */
  decodedWaveform: number[];
  mimeType: string;
  textSnapshot: string;
  voiceSnapshot?: VoiceSnapshot;
}

/** Build a completed TTS payload. Requires real decoded audio + waveform. */
export function buildTtsVoicePayload(input: TtsVoiceInput): VoiceMessagePayload {
  if (!input.audioAssetId) throw new Error('tts voice requires an audio asset');
  if (!input.decodedWaveform.length) throw new Error('tts voice requires a decoded waveform');
  return {
    source: 'tts',
    audioAssetId: input.audioAssetId,
    durationMs: input.durationMs,
    waveform: input.decodedWaveform,
    mimeType: input.mimeType,
    textSnapshot: input.textSnapshot,
    voiceSnapshot: input.voiceSnapshot,
    ttsStatus: 'ready',
  };
}
