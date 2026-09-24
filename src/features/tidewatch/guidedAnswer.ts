/**
 * TIDEWATCH — guided check-in presentation copy.
 *
 * Pure presentation descriptors for the 4-step guided flow.
 * These strings are never persisted into the Activity Ledger or Check-in
 * rows; numeric mapping stays canonical: value 1..5 → options[value - 1].
 */

export interface GuidedOption {
  label: string;
  descriptor: string;
}

export interface GuidedQuestion {
  prompt: string;
  options: readonly GuidedOption[];
}

export const GUIDED_QUESTIONS: readonly GuidedQuestion[] = [
  {
    prompt: '現在的心情？',
    options: [
      { label: '很差', descriptor: '今天狀態明顯低迷' },
      { label: '有點低', descriptor: '有些疲憊，需要喘口氣' },
      { label: '普通', descriptor: '穩穩的，沒有特別起伏' },
      { label: '不錯', descriptor: '心情愉快，蠻順利的' },
      { label: '很好', descriptor: '狀態超讚，充滿動力' },
    ],
  },
  {
    prompt: '現在的能量？',
    options: [
      { label: '很低', descriptor: '幾乎撐不住，需要休息' },
      { label: '偏低', descriptor: '有點沒力氣' },
      { label: '適中', descriptor: '剛好能撐日常' },
      { label: '偏高', descriptor: '動力充足' },
      { label: '很高', descriptor: '火力全開，精力旺盛' },
    ],
  },
  {
    prompt: '現在的專注？',
    options: [
      { label: '渙散', descriptor: '很難維持注意力' },
      { label: '偏散', descriptor: '容易被別的事情帶走' },
      { label: '一般', descriptor: '可以繼續當前事情' },
      { label: '集中', descriptor: '大部分注意力都在這裡' },
      { label: '深度', descriptor: '持續投入，不太想被打斷' },
    ],
  },
];

export const GUIDE_STEP_LABELS = ['活動', '心情', '能量', '專注'] as const;

export function guidedStepLabel(stepIndex: number): string {
  const index = Math.min(Math.max(Math.trunc(stepIndex), 0), GUIDE_STEP_LABELS.length - 1);
  return GUIDE_STEP_LABELS[index];
}

/** questionIndex: 0=mood, 1=energy, 2=focus. Returns label+descriptor or null. */
export function guidedQuestionOption(questionIndex: number, value: number): GuidedOption | null {
  const question = GUIDED_QUESTIONS[questionIndex];
  if (!question || !Number.isInteger(value) || value < 1 || value > question.options.length) return null;
  return question.options[value - 1];
}
