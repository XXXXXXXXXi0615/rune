/**
 * Transcription Service — OpenAI Whisper / speech-to-text compatible interface.
 *
 * Does NOT hardcode endpoints — reads ProviderConfig for baseUrl + apiKey.
 * Supports both segments (verbose_json) and plain text fallback.
 */

import type { ProviderConfig } from '@/types';

/* ── Types ── */

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
}

export interface TranscriptionError extends Error {
  code?: 'NO_API_KEY' | 'FILE_UNAVAILABLE' | 'SIZE_EXCEEDED' | 'API_ERROR' | 'NETWORK' | 'PARSE_ERROR';
  status?: number;
}

/* ── Constants ── */

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/* ── Public API ── */

/**
 * Transcribe an audio file using an OpenAI Whisper-compatible endpoint.
 * Derives the endpoint URL from the provider's baseUrl.
 */
export async function transcribeAudio(
  file: File | Blob,
  config: ProviderConfig,
): Promise<TranscriptionResult> {
  if (!config.apiKey) {
    const err = new Error('No API key configured') as TranscriptionError;
    err.code = 'NO_API_KEY';
    throw err;
  }

  if (file.size > MAX_FILE_SIZE) {
    const err = new Error('File exceeds 25 MB limit') as TranscriptionError;
    err.code = 'SIZE_EXCEEDED';
    throw err;
  }

  const base = config.baseUrl.replace(/\/+$/, '');
  const endpoint = `${base}/audio/transcriptions`;

  const form = new FormData();
  form.append('file', file, (file instanceof File) ? file.name : 'audio.mp3');
  form.append('model', config.model || 'whisper-1');
  form.append('response_format', 'verbose_json');
  // Some providers require timestamp_granularities for word-level segments
  form.append('timestamp_granularities', '["segment"]');

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: form,
    });
  } catch (e) {
    const err = new Error('Network error while contacting transcription service') as TranscriptionError;
    err.code = 'NETWORK';
    throw err;
  }

  if (!response.ok) {
    const err = new Error(
      `Transcription API returned ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`,
    ) as TranscriptionError;
    err.code = 'API_ERROR';
    err.status = response.status;
    throw err;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    const err = new Error('Failed to parse transcription response') as TranscriptionError;
    err.code = 'PARSE_ERROR';
    throw err;
  }

  return parseTranscriptionResponse(data);
}

/* ── Helpers ── */

/** Parse the verbose_json response into our canonical format. */
function parseTranscriptionResponse(data: unknown): TranscriptionResult {
  const obj = data as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') {
    throw Object.assign(new Error('Unexpected response format'), { code: 'PARSE_ERROR' });
  }

  const text = typeof obj.text === 'string' ? obj.text : '';
  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];

  const segments: TranscriptionSegment[] = rawSegments
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
    .map((s) => ({
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      text: typeof s.text === 'string' ? s.text.trim() : '',
    }))
    .filter((s) => s.text.length > 0);

  return { text, segments };
}

/**
 * Convert timestamped segments to LRC format.
 *
 * Format: [mm:ss.xx]text
 */
export function segmentsToLrc(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) return '';

  const lines: string[] = [];
  for (const seg of segments) {
    const totalSeconds = seg.start;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds.toFixed(2)).padStart(5, '0'); // ss.xx
    lines.push(`[${mm}:${ss}]${seg.text}`);
  }
  return lines.join('\n');
}
