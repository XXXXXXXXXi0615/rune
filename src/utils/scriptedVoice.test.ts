import { describe, expect, it } from 'vitest';
import {
  buildRecordedVoicePayload,
  buildScriptedVoicePayload,
  buildTtsVoicePayload,
  deterministicWaveform,
  estimateScriptedDurationMs,
  splitCaptionSegments,
} from './scriptedVoice';

describe('voice message sources', () => {
  it('keeps the three sources distinct: recorded / scripted / tts', () => {
    const recorded = buildRecordedVoicePayload({ audioAssetId: 'asset-1', durationMs: 1200, waveform: [0.5, 1], mimeType: 'audio/webm' });
    const scripted = buildScriptedVoicePayload({ text: '今晚的月亮很亮', tone: '溫柔', rate: 1 });
    const tts = buildTtsVoicePayload({
      audioAssetId: 'asset-2',
      durationMs: 2200,
      decodedWaveform: [0.2, 0.9, 0.4],
      mimeType: 'audio/mpeg',
      textSnapshot: '今晚的月亮很亮',
    });

    expect(recorded.source).toBe('recorded');
    expect(scripted.source).toBe('scripted');
    expect(tts.source).toBe('tts');
    expect(recorded.audioAssetId).toBe('asset-1');
    expect(tts.audioAssetId).toBe('asset-2');
    expect(tts.ttsStatus).toBe('ready');
  });

  it('scripted messages never fabricate an audioAssetId', () => {
    const scripted = buildScriptedVoicePayload({ text: '這是一段演繹', rate: 1.1 });
    expect(scripted.audioAssetId).toBeUndefined();
    expect(scripted.mimeType).toBeUndefined();
    expect(scripted.textSnapshot).toBe('這是一段演繹');
    expect(scripted.voiceSnapshot?.rate).toBe(1.1);
    expect(scripted.durationMs).toBeGreaterThan(0);
  });

  it('scripted waveform is deterministic and stable across sessions', () => {
    const first = deterministicWaveform('潮汐在夜裡起伏', 'voice-a@1');
    const second = deterministicWaveform('潮汐在夜裡起伏', 'voice-a@1');
    expect(first).toEqual(second);
    expect(first).toHaveLength(64);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
    const differentText = deterministicWaveform('完全不同的一句話', 'voice-a@1');
    expect(differentText).not.toEqual(first);
  });

  it('tts payload requires a real decoded waveform and keeps the text snapshot', () => {
    expect(() => buildTtsVoicePayload({
      audioAssetId: 'asset-3',
      durationMs: 900,
      decodedWaveform: [],
      mimeType: 'audio/mpeg',
      textSnapshot: '要保留的文字',
    })).toThrow();

    const decoded = [0.1, 0.8, 0.3, 0.6];
    const tts = buildTtsVoicePayload({
      audioAssetId: 'asset-3',
      durationMs: 900,
      decodedWaveform: decoded,
      mimeType: 'audio/mpeg',
      textSnapshot: '要保留的文字',
    });
    expect(tts.waveform).toEqual(decoded);
    expect(tts.waveform).not.toEqual(deterministicWaveform('要保留的文字'));
    expect(tts.textSnapshot).toBe('要保留的文字');
  });

  it('estimates scripted duration from text and rate', () => {
    const slow = estimateScriptedDurationMs('月亮升起來了，潮水也跟著醒了。', 0.8);
    const fast = estimateScriptedDurationMs('月亮升起來了，潮水也跟著醒了。', 1.4);
    expect(slow).toBeGreaterThan(fast);
    expect(estimateScriptedDurationMs('', 1)).toBe(0);
    expect(estimateScriptedDurationMs('嗨', 1)).toBeGreaterThanOrEqual(1000);
  });

  it('splits captions on punctuation for the no-synthesis fallback', () => {
    const segments = splitCaptionSegments('你好。今晚想聊聊嗎？好呀');
    expect(segments).toEqual(['你好。', '今晚想聊聊嗎？', '好呀']);
  });
});
