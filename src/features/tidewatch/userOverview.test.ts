import { describe, expect, it } from 'vitest';
import { normalizeQuest } from '@/store/useQuestStore';
import { selectTidewatchQuest } from './userOverview';
const now = new Date('2026-09-04T12:00:00+08:00');
describe('Tidewatch USER overview projections', () => {
  it('projects canonical main quest without duplication', () => {
    const quest = normalizeQuest({ id: 'q1', title: '每日專注', dueAt: now.toISOString(), estimatedMinutes: 25, rewardTier: 'normal', status: 'available' }, 'q1');
    expect(selectTidewatchQuest([quest], { '2026-09-04': 'q1' }, now)).toMatchObject({ questId: 'q1', rewardMoonDew: 8, claimed: false });
  });
});
