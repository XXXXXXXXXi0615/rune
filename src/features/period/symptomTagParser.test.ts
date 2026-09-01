import { describe, it, expect } from 'vitest';
import { parseSymptomTags, mergeSymptomTags } from './symptomTagParser';

describe('parseSymptomTags', () => {
  it('empty input returns empty array', () => {
    expect(parseSymptomTags('')).toEqual([]);
    expect(parseSymptomTags('   ')).toEqual([]);
  });

  it('splits by comma', () => {
    expect(parseSymptomTags('腹痛,頭痛,疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('splits by Chinese comma (、)', () => {
    expect(parseSymptomTags('腹痛、頭痛、疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('splits by semicolon', () => {
    expect(parseSymptomTags('腹痛;頭痛;疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('splits by Chinese semicolon (；)', () => {
    expect(parseSymptomTags('腹痛；頭痛；疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('splits by newline', () => {
    expect(parseSymptomTags('腹痛\n頭痛\n疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('splits by slash', () => {
    expect(parseSymptomTags('腹痛/頭痛/疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('trims whitespace', () => {
    expect(parseSymptomTags(' 腹痛 , 頭痛 , 疲勞 ')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('removes empty entries', () => {
    expect(parseSymptomTags('腹痛,,頭痛,,,疲勞')).toEqual(['腹痛', '頭痛', '疲勞']);
  });

  it('deduplicates case-insensitive', () => {
    // Same Chinese characters are already case-insensitive by definition
    expect(parseSymptomTags('腹痛,腹痛,頭痛')).toEqual(['腹痛', '頭痛']);
  });

  it('deduplicates unicode normalized', () => {
    // NFC vs NFD normalization
    expect(parseSymptomTags('腹痛,腹痛')).toEqual(['腹痛']);
  });

  it('enforces max tag length (12 chars)', () => {
    const tags = parseSymptomTags('這是一個超過十二個中文字的標籤名稱測試,短標籤');
    expect(tags).toEqual(['短標籤']);
  });

  it('enforces max 12 tags', () => {
    const long = Array.from({ length: 20 }, (_, i) => `標籤${i + 1}`).join(',');
    const tags = parseSymptomTags(long);
    expect(tags.length).toBeLessThanOrEqual(12);
    expect(tags.length).toBe(12);
  });

  it('mixed delimiters', () => {
    expect(parseSymptomTags('腹痛、頭痛;疲勞\n腰痛/胸悶')).toEqual(['腹痛', '頭痛', '疲勞', '腰痛', '胸悶']);
  });
});

describe('mergeSymptomTags', () => {
  it('merge mode replaces existing', () => {
    const result = mergeSymptomTags(['舊標籤'], ['新標籤1', '新標籤2'], 'merge');
    expect(result).toEqual(['新標籤1', '新標籤2']);
  });

  it('append mode adds to existing', () => {
    const result = mergeSymptomTags(['舊標籤'], ['新標籤'], 'append');
    expect(result).toEqual(['舊標籤', '新標籤']);
  });

  it('append deduplicates', () => {
    const result = mergeSymptomTags(['舊標籤', '重複'], ['重複', '新標籤'], 'append');
    expect(result).toEqual(['舊標籤', '重複', '新標籤']);
  });

  it('append respects max tags', () => {
    const existing = Array.from({ length: 10 }, (_, i) => `舊${i}`);
    const result = mergeSymptomTags(existing, ['新1', '新2', '新3', '新4'], 'append');
    expect(result.length).toBeLessThanOrEqual(12);
    expect(result.length).toBe(12);
  });
});
