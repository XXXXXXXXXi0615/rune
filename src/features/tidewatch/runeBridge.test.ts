import { describe, it, expect, beforeEach } from 'vitest';
import { deriveRuneIntent, formatRuneIntent, describeRuneIntent, resetRuneBridgeThresholds } from './runeBridge';
import type { RuneBridgeInput } from './types';

describe('deriveRuneIntent', () => {
  beforeEach(() => {
    resetRuneBridgeThresholds();
  });

  it('returns idle when not focused and not typing', () => {
    const result = deriveRuneIntent({
      isFocused: false,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 0,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).toBe('idle');
  });

  it('returns focused when focused and not typing', () => {
    const result = deriveRuneIntent({
      isFocused: true,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 0,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).toBe('focused');
  });

  it('returns typing when typing and not paused', () => {
    const result = deriveRuneIntent({
      isFocused: true,
      isTyping: true,
      typingPaused: false,
      currentSessionChars: 0,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).toBe('typing');
    expect(result.reason).toBe('正在輸入');
  });

  it('returns paused when typing is paused', () => {
    const result = deriveRuneIntent({
      isFocused: true,
      isTyping: true,
      typingPaused: true,
      currentSessionChars: 0,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).toBe('paused');
    expect(result.reason).toBe('輸入暫停');
  });

  it('returns session-proud when session chars >= 200', () => {
    const result = deriveRuneIntent({
      isFocused: true,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 250,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).toBe('session-proud');
    expect(result.reason).toContain('250');
  });

  it('returns daily-proud when today chars >= 5000', () => {
    const result = deriveRuneIntent({
      isFocused: false,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 0,
      todayUserChars: 5500,
      newMilestone: false,
    });
    expect(result.intent).toBe('daily-proud');
    expect(result.reason).toContain('5500');
  });

  it('returns milestone-pleased when new milestone', () => {
    const result = deriveRuneIntent({
      isFocused: true,
      isTyping: true,
      typingPaused: false,
      currentSessionChars: 500,
      todayUserChars: 10000,
      newMilestone: true,
    });
    expect(result.intent).toBe('milestone-pleased');
    expect(result.reason).toBe('新的里程碑達成');
  });

  it('does not re-fire session threshold within cooldown', () => {
    // First fire
    deriveRuneIntent({
      isFocused: false,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 250,
      todayUserChars: 0,
      newMilestone: false,
    });
    // Second fire within cooldown → should NOT fire session-proud again
    const result = deriveRuneIntent({
      isFocused: false,
      isTyping: false,
      typingPaused: false,
      currentSessionChars: 300,
      todayUserChars: 0,
      newMilestone: false,
    });
    expect(result.intent).not.toBe('session-proud');
  });
});

describe('formatRuneIntent', () => {
  it('formats all intents', () => {
    expect(formatRuneIntent('idle')).toBe('閒置');
    expect(formatRuneIntent('focused')).toBe('專注');
    expect(formatRuneIntent('typing')).toBe('書寫中');
    expect(formatRuneIntent('paused')).toBe('思考中');
    expect(formatRuneIntent('session-proud')).toBe('書寫成就');
    expect(formatRuneIntent('daily-proud')).toBe('今日里程碑');
    expect(formatRuneIntent('milestone-pleased')).toBe('里程碑達成');
    expect(formatRuneIntent('curious')).toBe('好奇');
  });
});

describe('describeRuneIntent', () => {
  it('returns reason when available', () => {
    const output = describeRuneIntent({ intent: 'typing', reason: '正在輸入' });
    expect(output).toBe('正在輸入');
  });

  it('falls back to formatted intent', () => {
    const output = describeRuneIntent({ intent: 'idle' });
    expect(output).toBe('閒置');
  });
});
