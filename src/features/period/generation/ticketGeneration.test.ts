import { describe, expect, it } from 'vitest';
import { createPeriodRecord, loadPeriodRecords } from '@/utils/periodStorage';
import { generatePeriodJournal } from '@/features/period/generation/generatePeriodJournal';

function record(partial: Partial<ReturnType<typeof createPeriodRecord>> = {}) {
  return {
    ...createPeriodRecord('2026-09-01', '2026-09-01', [], '', 'calm', '平潮', '中', { symptomRawText: '', symptomTags: [] }),
    id: 'period_test_0001',
    ...partial,
  };
}

describe('generatePeriodJournal — deterministic local generation', () => {
  it('full record: all present fields appear, nothing extra', () => {
    const source = record({
      flowLevel: '中',
      mood: 'gentle',
      symptomRawText: '有點疲倦，下午腰有點酸。',
      symptomTags: ['疲倦'],
      notes: '今天工作很多。',
      symptoms: ['腰痛'],
    });
    const content = generatePeriodJournal(source, { cycleDay: 2 });
    expect(content.title).toBe('週期紀錄 · 2026/09/01');
    expect(content.body).toContain('9 月 1 日，週期第 2 天。');
    expect(content.body).toContain('今天的經量為中。');
    expect(content.body).toContain('情緒偏輕柔。');
    expect(content.body).toContain('身體狀態：有點疲倦，下午腰有點酸。');
    expect(content.body).toContain('備註：今天工作很多。');
  });

  it('missing mood: no mood sentence, others intact', () => {
    const source = record({ mood: undefined, flowLevel: '重', symptomRawText: '腹痛' });
    const content = generatePeriodJournal(source);
    expect(content.body).not.toContain('情緒');
    expect(content.body).toContain('今天的經量為重。');
    expect(content.body).toContain('身體狀態：腹痛。');
  });

  it('missing raw text: no body-state sentence, no null/undefined', () => {
    const source = record({ symptomRawText: '', symptomTags: [] });
    const content = generatePeriodJournal(source);
    expect(content.body).not.toContain('身體狀態');
    expect(content.body).not.toMatch(/undefined|null|未填寫/);
  });

  it('missing note: no note sentence', () => {
    const source = record({ notes: '' });
    const content = generatePeriodJournal(source);
    expect(content.body).not.toContain('備註');
  });

  it('minimal record (date only): exactly one sentence', () => {
    const source = record({ flowLevel: '', mood: undefined, symptomRawText: '', notes: '', symptoms: [] });
    const content = generatePeriodJournal(source);
    expect(content.body).toBe('9 月 1 日的週期紀錄。');
  });

  it('legacy record (symptoms only, no phase 3.2 fields): graceful mention, no crash', () => {
    const legacy = { ...record({ symptoms: ['腹痛', '頭痛', '腹脹'] }), symptomRawText: undefined, symptomTags: undefined, mood: undefined, flowLevel: undefined };
    const content = generatePeriodJournal(legacy);
    expect(content.body).toContain('已記錄 3 項症狀。');
    expect(content.body).not.toMatch(/undefined|null|未填寫/);
  });

  it('never invents information absent from source', () => {
    const source = record({ flowLevel: '中' });
    const content = generatePeriodJournal(source);
    const forbidden = ['疼', '痛', '失眠', '昏睡', '建議', '原因', '可能是', '應該', '注意', '就医', '就醫'];
    for (const word of forbidden) {
      expect(content.body, `should not mention ${word}`).not.toContain(word);
    }
  });

  it('phase label is only used when passed and not the fallback', () => {
    const source = record({});
    const withPhase = generatePeriodJournal(source, { phaseLabel: '經期中' });
    expect(withPhase.body).toContain('如今是經期中。');
    const withFallback = generatePeriodJournal(source, { phaseLabel: '未記錄' });
    expect(withFallback.body).not.toContain('如今是');
  });

  it('deterministic: identical input → identical output', () => {
    const source = record({ flowLevel: '輕', mood: 'stormy', symptomRawText: '想睡', notes: '門診日' });
    const a = generatePeriodJournal(source, { cycleDay: 3 });
    const b = generatePeriodJournal({ ...source }, { cycleDay: 3 });
    expect(a).toEqual(b);
  });

  it('raw text punctuation: trailing punctuation is normalized deterministically', () => {
    const source = record({ symptomRawText: '下午腰酸。。。', notes: '好累！' });
    const content = generatePeriodJournal(source);
    expect(content.body).toContain('身體狀態：下午腰酸。');
    expect(content.body).toContain('備註：好累。');
    expect(content.body).not.toContain('。。。');
  });

  it('does not touch global storage (pure)', () => {
    const before = localStorage.getItem('lunartide_period_records_v1');
    generatePeriodJournal(record({ symptomRawText: '腹痛' }));
    expect(localStorage.getItem('lunartide_period_records_v1')).toBe(before);
    void loadPeriodRecords; // storage helper unaffected
  });
});
