export interface VoiceSynthesisRequest {
  text: string;
  voiceId: string;
  modelId?: string;
  speed?: number;
  emotionStyle?: string;
  signal?: AbortSignal;
}

export interface VoiceSynthesisProvider {
  readonly id: 'minimax' | 'elevenlabs';
  listVoices(signal?: AbortSignal): Promise<Array<{ id: string; label: string }>>;
  synthesize(request: VoiceSynthesisRequest): Promise<Blob>;
  streamSynthesis(request: VoiceSynthesisRequest): AsyncIterable<Uint8Array>;
  cancel(): void;
}

abstract class BackendVoiceProvider implements VoiceSynthesisProvider {
  abstract readonly id: 'minimax' | 'elevenlabs';
  protected controller?: AbortController;
  abstract listVoices(signal?: AbortSignal): Promise<Array<{ id: string; label: string }>>;
  abstract synthesize(request: VoiceSynthesisRequest): Promise<Blob>;
  abstract streamSynthesis(request: VoiceSynthesisRequest): AsyncIterable<Uint8Array>;
  cancel() { this.controller?.abort(); this.controller = undefined; }
}

export class MiniMaxVoiceProvider extends BackendVoiceProvider {
  readonly id = 'minimax' as const;
  async listVoices() { return []; }
  async synthesize(_request: VoiceSynthesisRequest): Promise<Blob> { throw new Error('MiniMax TTS requires a backend proxy.'); }
  async *streamSynthesis(): AsyncIterable<Uint8Array> { throw new Error('MiniMax streaming requires a backend proxy.'); }
}

export class ElevenLabsVoiceProvider extends BackendVoiceProvider {
  readonly id = 'elevenlabs' as const;
  async listVoices() { return []; }
  async synthesize(_request: VoiceSynthesisRequest): Promise<Blob> { throw new Error('ElevenLabs TTS requires a backend proxy.'); }
  async *streamSynthesis(): AsyncIterable<Uint8Array> { throw new Error('ElevenLabs streaming requires a backend proxy.'); }
}
