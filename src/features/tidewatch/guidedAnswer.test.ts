import { describe, expect, it } from 'vitest';
import { GUIDED_QUESTIONS, guidedQuestionOption, guidedStepLabel } from './guidedAnswer';

describe('guided check-in presentation copy', () => {
  it('keeps three scale questions with five options each in canonical order', () => {
    expect(GUIDED_QUESTIONS).toHaveLength(3);
    for (const question of GUIDED_QUESTIONS) {
      expect(question.options).toHaveLength(5);
      expect(question.options.every((option) => option.label && option.descriptor)).toBe(true);
    }
    expect(GUIDED_QUESTIONS[2].options[4]).toMatchObject({ label: '深度', descriptor: '持續投入，不太想被打斷' });
  });

  it('never fabricates a descriptor or leaks into numeric mapping', () => {
    expect(guidedQuestionOption(2, 5)).toMatchObject({ label: '深度', descriptor: '持續投入，不太想被打斷' });
    expect(guidedQuestionOption(2, 0)).toBeNull();
    expect(guidedQuestionOption(2, 6)).toBeNull();
    expect(guidedQuestionOption(3, 2)).toBeNull();
    expect(guidedQuestionOption(-1, 2)).toBeNull();
    expect(guidedQuestionOption(2, 2.5)).toBeNull();
  });

  it('maps step indices to labels and clamps out-of-range', () => {
    expect(guidedStepLabel(0)).toBe('活動');
    expect(guidedStepLabel(1)).toBe('心情');
    expect(guidedStepLabel(2)).toBe('能量');
    expect(guidedStepLabel(3)).toBe('專注');
    expect(guidedStepLabel(4)).toBe('專注');
    expect(guidedStepLabel(-1)).toBe('活動');
  });
});
