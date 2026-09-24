import { describe, expect, it, vi } from 'vitest';
import { consequenceSourceEventId, eligibleConsequenceItems, resolveConsequenceLifecycle, resolveConsequenceSelection, shouldFulfillTimerConsequence, validateConsequenceSafety } from './consequenceEngine';
import type { ConsequencePoolItem, TidewatchConsequence } from './types';

const item = (id: string, intensity: number, enabled = true, weight = 1): ConsequencePoolItem => ({ id, title: `安全項目 ${id}`, enabled, intensity, executionType: 'manual', weight, createdAt: 1, updatedAt: 1 });
const pending = (): TidewatchConsequence => ({ id: 'c', sourceEventId: 'f', questId: 'q', questTitleSnapshot: '主線', lifecycle: 'pending', createdAt: 1, updatedAt: 1 });

describe('consequence foundation', () => {
  it('uses a stable unique source event id', () => expect(consequenceSourceEventId('q', '2026-09-06T12:00:00.000Z')).toBe('quest-overdue:q:2026-09-06T12:00:00.000Z'));
  it('only advances the lifecycle', () => { vi.spyOn(Date, 'now').mockReturnValue(9); const active = resolveConsequenceLifecycle(pending(), 'active'); expect(active.lifecycle).toBe('active'); expect(resolveConsequenceLifecycle(active, 'revealed')).toBe(active); vi.restoreAllMocks(); });
  it('filters by enabled and 1-star / 5-star intensity', () => { const pool = [item('one', 1), item('five', 5), item('off', 1, false)]; expect(eligibleConsequenceItems(pool, 1).map((entry) => entry.id)).toEqual(['one']); expect(eligibleConsequenceItems(pool, 5).map((entry) => entry.id)).toEqual(['one', 'five']); expect(eligibleConsequenceItems([], 5)).toEqual([]); });
  it('uses weighted injected RNG deterministically', () => { const pool = [item('a', 1, true, 1), item('b', 1, true, 3)]; expect(resolveConsequenceSelection(pending(), pool, 1, () => 0, 9).selectedItemId).toBe('a'); expect(resolveConsequenceSelection(pending(), pool, 1, () => .9, 9).selectedItemId).toBe('b'); });
  it('resolves once and preserves its snapshot after pool edits or deletion', () => { const original = item('a', 1); const resolved = resolveConsequenceSelection(pending(), [original], 1, () => 0, 9); expect(resolveConsequenceSelection(resolved, [{ ...original, title: '已改名' }], 1, () => .9, 10)).toBe(resolved); expect(resolveConsequenceSelection(resolved, [], 1, () => .9, 10).selectedItemSnapshot?.title).toBe('安全項目 a'); });
  it('rejects deterministic unsafe pool entries', () => { expect(validateConsequenceSafety('整理桌面')).toEqual({ safe: true }); expect(validateConsequenceSafety('今晚不准睡')).toMatchObject({ safe: false }); expect(validateConsequenceSafety('')).toMatchObject({ safe: false }); });
  it('timer completion fulfills while cancel or interruption does not', () => { const active: TidewatchConsequence = { ...pending(), lifecycle: 'active', timerSessionId: 'focus-1', selectedItemSnapshot: { title: '專注', intensity: 2, executionType: 'timer', durationMinutes: 20 } }; expect(shouldFulfillTimerConsequence(active, { sessionId: 'focus-1', outcome: 'completed' })).toBe(true); expect(shouldFulfillTimerConsequence(active, { sessionId: 'focus-1', outcome: 'abandoned' })).toBe(false); expect(shouldFulfillTimerConsequence(active, null)).toBe(false); });
});
