import { describe, expect, it, vi } from 'vitest';
import { normalizeQuest } from '@/store/useQuestStore';
import { applyApprovedReviewTransition } from './reviewTransition';
import type { ReviewRecord } from './types';

const quest = normalizeQuest({ id: 'q', title: '主線', status: 'in_progress', estimatedMinutes: 40, dueAt: '2026-09-06T12:00:00.000Z' }, 'q');
const record = (patch: Partial<ReviewRecord> = {}): ReviewRecord => ({ id: 'r', questId: 'q', questTitleSnapshot: '主線', requestType: 'defer', reasonSnapshot: '完整理由', difficultySnapshot: 2, decision: { decision: 'approved', reasonCode: 'requirements_met', message: 'ok' }, createdAt: 1, ...patch });

describe('review transition stays on the canonical Quest port', () => {
  it('applies approved review through updateQuest', () => { const port = { updateQuest: vi.fn(), abandonQuest: vi.fn() }; expect(applyApprovedReviewTransition(record({ resumeAtSnapshot: '2026-09-07T09:00:00.000Z' }), quest, port)).toBe(true); expect(port.updateQuest).toHaveBeenCalledWith('q', { dueAt: '2026-09-07T09:00:00.000Z' }); });
  it('does not mutate rejected review', () => { const port = { updateQuest: vi.fn(), abandonQuest: vi.fn() }; expect(applyApprovedReviewTransition(record({ decision: { decision: 'rejected', reasonCode: 'invalid', message: 'no' } }), quest, port)).toBe(false); expect(port.updateQuest).not.toHaveBeenCalled(); expect(port.abandonQuest).not.toHaveBeenCalled(); });
  it('waits for acceptance before a conditional transition', () => { const port = { updateQuest: vi.fn(), abandonQuest: vi.fn() }; const conditional = record({ requestType: 'abandon', decision: { decision: 'conditional', reasonCode: 'condition', message: 'confirm', conditions: ['確認'] } }); expect(applyApprovedReviewTransition(conditional, quest, port)).toBe(false); expect(applyApprovedReviewTransition({ ...conditional, conditionsAcceptedAt: 2 }, quest, port)).toBe(true); expect(port.abandonQuest).toHaveBeenCalledWith('q'); });
});
