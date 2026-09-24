import type { ChatVoiceMessage, VoiceSnapshot } from '@/types';
import { saveAsset } from '@/store/assets';
import { decodeBlobWaveform } from '@/utils/audioWaveform';

export class TtsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TtsError';
  }
}

export function getTtsEndpoint(): string | null {
  const endpoint = import.meta.env.VITE_TTS_ENDPOINT || import.meta.env.VITE_LUNARIS_TTS_ENDPOINT;
  return typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : null;
}

/** Request real synthesized audio from the backend TTS provider. */
export async function synthesizeSpeech(text: string, voiceSnapshot?: VoiceSnapshot): Promise<Blob> {
  const endpoint = getTtsEndpoint();
  if (!endpoint) throw new TtsError('尚未設定 TTS 服務端點');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: voiceSnapshot?.voiceName,
      rate: voiceSnapshot?.rate,
      pitch: voiceSnapshot?.pitch,
      lang: voiceSnapshot?.lang,
      tone: voiceSnapshot?.tone,
    }),
  });
  if (!response.ok) throw new TtsError(`TTS 服務回應 ${response.status}`);
  const blob = await response.blob();
  if (!blob.size) throw new TtsError('TTS 服務回傳空音訊');
  return blob;
}

/**
 * Run the full TTS upgrade pipeline for a voice message:
 * backend synthesis → Blob into IndexedDB → waveform decoded from the real
 * audio (never a text-hash waveform) → message patched to ttsStatus 'ready'.
 * On failure the message is marked 'failed' and can be retried; the
 * textSnapshot is always retained.
 */
export async function runTtsPipeline(message: Pick<ChatVoiceMessage, 'id' | 'textSnapshot' | 'voiceSnapshot'>): Promise<void> {
  const { useAppStore } = await import('@/store/useAppStore');
  const patch = useAppStore.getState().updateVoiceMessage;
  const text = message.textSnapshot?.trim();
  if (!text) {
    patch(message.id, { ttsStatus: 'failed' });
    return;
  }
  patch(message.id, { ttsStatus: 'pending' });
  try {
    const blob = await synthesizeSpeech(text, message.voiceSnapshot);
    const mimeType = blob.type || 'audio/mpeg';
    const decoded = await decodeBlobWaveform(blob);
    const audioAssetId = await saveAsset(blob, mimeType);
    patch(message.id, {
      audioAssetId,
      mimeType,
      durationMs: decoded.durationMs,
      waveform: decoded.waveform,
      ttsStatus: 'ready',
    });
  } catch {
    patch(message.id, { ttsStatus: 'failed' });
  }
}
