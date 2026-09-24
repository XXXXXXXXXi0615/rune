import { describe, it, expect } from 'vitest';
import { countWritingGraphemes, countNonWhitespaceGraphemes } from '@/utils/countWritingGraphemes';

describe('countWritingGraphemes', () => {
  it('counts ASCII characters', () => {
    expect(countWritingGraphemes('hello')).toBe(5);
    expect(countWritingGraphemes('a')).toBe(1);
    expect(countWritingGraphemes('')).toBe(0);
  });

  it('counts Chinese characters', () => {
    expect(countWritingGraphemes('你好世界')).toBe(4);
    expect(countWritingGraphemes('觀測站')).toBe(3);
  });

  it('counts Japanese characters', () => {
    expect(countWritingGraphemes('こんにちは')).toBe(5);
    expect(countWritingGraphemes('日本語')).toBe(3);
  });

  it('counts emoji as single grapheme clusters', () => {
    expect(countWritingGraphemes('😀')).toBe(1);
    expect(countWritingGraphemes('👍')).toBe(1);
  });

  it('counts combined emoji (skin tone modifiers)', () => {
    // 👋🏽 = waving hand + medium skin tone
    expect(countWritingGraphemes('👋🏽')).toBe(1);
    // Family emoji: 👨‍👩‍👧‍👦 = 4 people joined by ZWJ
    expect(countWritingGraphemes('👨‍👩‍👧‍👦')).toBe(1);
  });

  it('counts punctuation', () => {
    expect(countWritingGraphemes('你好！')).toBe(3);
    expect(countWritingGraphemes('hello, world!')).toBe(13);
  });

  it('counts line breaks as single graphemes', () => {
    expect(countWritingGraphemes('hello\nworld')).toBe(11);
    expect(countWritingGraphemes('line1\nline2\nline3')).toBe(17);
  });

  it('handles mixed content', () => {
    expect(countWritingGraphemes('Hello 你好 👋')).toBe(10);
  });

  it('handles whitespace-only strings', () => {
    expect(countWritingGraphemes('   ')).toBe(3);
    expect(countWritingGraphemes('\n\n')).toBe(2);
  });
});

describe('countNonWhitespaceGraphemes', () => {
  it('ignores whitespace segments', () => {
    expect(countNonWhitespaceGraphemes('hello world')).toBe(10);
    expect(countNonWhitespaceGraphemes('  ')).toBe(0);
    expect(countNonWhitespaceGraphemes('')).toBe(0);
  });

  it('counts CJK without whitespace', () => {
    expect(countNonWhitespaceGraphemes('你好 世界')).toBe(4);
  });

  it('counts emoji without whitespace', () => {
    expect(countNonWhitespaceGraphemes('👋 😀')).toBe(2);
  });
});
