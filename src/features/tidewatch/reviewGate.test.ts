import { describe, expect, it } from 'vitest';
import { decideReview, effectiveReviewDifficulty, normalizeReason, selectAdaptiveDifficultyExplanation, validateReasonQuality } from './reviewGate';
import type { ReviewRecord } from './types';

const valid = (difficulty: number, reason: string, extra = {}) => validateReasonQuality({ reason, nextAction: '明早先整理第一個段落並完成草稿', recoveryPlan: '拆成兩段完成，先關閉通知再重新開始', resumeAt: '2026-09-07T09:00:00.000Z', consequenceAcknowledged: true, ...extra }, difficulty);

describe('Rune Review pure validator', () => {
  it('normalizes whitespace without blocking pasted content', () => expect(normalizeReason('  我需要\n 重新安排  ')).toBe('我需要 重新安排'));
  it('accepts a substantive 1-star reason with 15+ chars', () => expect(valid(1, '今天臨時增加必要家務，我會在晚餐後重新處理這項任務。').valid).toBe(true));
  it('rejects short, repetitive and filler-only reasons', () => {
    expect(valid(1, '太短').reasonCodes).toContain('reason_too_short');
    expect(valid(1, '啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊').reasonCodes).toContain('excessive_repetition');
    expect(valid(1, '不知道').reasonCodes).toContain('filler_only');
  });
  it('does not reject a legitimate phrase merely because it contains 累', () => expect(valid(1, '今天身體很累且注意力下降，我準備休息後再繼續。').reasonCodes).not.toContain('filler_only'));
  it('requires action and recovery plan from 3 stars', () => {
    const result = validateReasonQuality({ reason: '目前工作被臨時事件打斷，原定時段已無法完整處理，我需要重新安排並保留足夠專注時間完成。' }, 3);
    expect(result.reasonCodes).toEqual(expect.arrayContaining(['next_action_required', 'recovery_plan_required']));
  });
  it('enforces the full 5-star requirement', () => {
    const result = validateReasonQuality({ reason: '目前的安排因健康狀況與臨時照護責任產生衝突，我已重新評估今天剩餘時間，確認直接硬撐只會降低成果品質，因此申請調整，並會在恢復後先完成最重要的段落，再依序處理剩餘工作，避免同一問題再次發生。', nextAction: '先整理必要資料並完成第一段', recoveryPlan: '休息後關閉通知，分兩個專注時段完成', resumeAt: '2026-09-07T09:00:00.000Z' }, 5);
    expect(result.reasonCodes).toContain('consequence_acknowledgement_required');
    expect(valid(5, '目前的安排因健康狀況與臨時照護責任產生衝突，我已重新評估今天剩餘時間，確認直接硬撐只會降低成果品質，因此申請調整，並會在恢復後先完成最重要的段落，再依序處理剩餘工作，避免同一問題再次發生，同時預留檢查與修正的時間以確保最後成果符合原先要求。我也會重新檢查行程配置，把必要的緩衝時間寫進明天的計畫，並在開始前確認資料、工具與工作環境都已準備妥當。').valid).toBe(true);
  });
  it('rejects a duplicate recent reason', () => { const reason = '今天臨時增加必要家務，我會在晚餐後重新處理這項任務。'; expect(validateReasonQuality({ reason }, 1, [reason]).reasonCodes).toContain('duplicate_recent_reason'); });
  it('returns approved, conditional and rejected decisions deterministically', () => {
    expect(decideReview('defer', valid(1, '今天臨時增加必要家務，我會在晚餐後重新處理這項任務。')).decision).toBe('approved');
    expect(decideReview('abandon', valid(1, '這項任務已失去實際價值，我決定停止並重新整理主線。')).decision).toBe('conditional');
    expect(decideReview('pause', valid(1, '太短')).decision).toBe('rejected');
  });
  it('raises adaptive difficulty temporarily and resets on the next local day', () => {
    const records = [1, 2].map((id) => ({ id: String(id), createdAt: new Date(2026, 8, 6, 10 + id).getTime() } as ReviewRecord));
    expect(effectiveReviewDifficulty(2, true, records, new Date(2026, 8, 6, 18))).toBe(3);
    expect(effectiveReviewDifficulty(2, true, records, new Date(2026, 8, 7, 8))).toBe(2);
    expect(effectiveReviewDifficulty(2, false, records, new Date(2026, 8, 6, 18))).toBe(2);
  });
  it('explains adaptive delta and a same-day base override without mutating base', () => { const records = [1,2].map((id) => ({ id: String(id), createdAt: new Date(2026, 8, 6, 10 + id).getTime() } as ReviewRecord)); expect(selectAdaptiveDifficultyExplanation(2, true, records, new Date(2026, 8, 6, 18))).toMatchObject({ baseDifficulty: 2, todayDerivedDifficulty: 3, delta: 1, appliesTodayOnly: true, overriddenToBase: false }); expect(selectAdaptiveDifficultyExplanation(2, true, records, new Date(2026, 8, 6, 18), true)).toMatchObject({ baseDifficulty: 2, todayDerivedDifficulty: 2, delta: 0, overriddenToBase: true }); });
});
