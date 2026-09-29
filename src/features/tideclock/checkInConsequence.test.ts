import { describe, expect, it } from 'vitest';
import { buildMissedConsequenceCopy, shouldPresentMissedConsequence } from './checkInConsequence';

const NOW = new Date(2026, 8, 20, 9, 0, 0); // 2026-09-20 local

const CANONICAL_VOICE = '「昨天沒來。\n『忘了』不是我接受的理由。\n現在，把今天該做的補上。」';

describe('buildMissedConsequenceCopy', () => {
  it('uses the canonical Phase 1 voice for yesterday', () => {
    const copy = buildMissedConsequenceCopy('2026-09-19', NOW);
    expect(copy.label).toBe('昨日漏簽');
    expect(copy.voice).toBe(CANONICAL_VOICE);
    expect(copy.hint).toBe('昨日漏簽已保留在報備紀錄中。');
  });

  it('substitutes only the leading date token for an older missed day', () => {
    const copy = buildMissedConsequenceCopy('2026-09-15', NOW);
    expect(copy.label).toBe('9月15日漏簽');
    expect(copy.voice).toContain('9月15日沒來。');
    expect(copy.voice).toContain('『忘了』不是我接受的理由。');
    expect(copy.voice).toContain('現在，把今天該做的補上。');
  });
});

describe('shouldPresentMissedConsequence', () => {
  it('presents once while the missed day is unacknowledged and today is open', () => {
    expect(shouldPresentMissedConsequence({ latestMissedDate: '2026-09-19', acknowledgedMissedDate: null, hasTodayRecord: false })).toBe(true);
  });

  it('does not present after the missed day was acknowledged', () => {
    expect(shouldPresentMissedConsequence({ latestMissedDate: '2026-09-19', acknowledgedMissedDate: '2026-09-19', hasTodayRecord: false })).toBe(false);
    expect(shouldPresentMissedConsequence({ latestMissedDate: '2026-09-19', acknowledgedMissedDate: '2026-09-25', hasTodayRecord: false })).toBe(false);
  });

  it('presents again only for a newer missed day', () => {
    expect(shouldPresentMissedConsequence({ latestMissedDate: '2026-09-19', acknowledgedMissedDate: '2026-09-18', hasTodayRecord: false })).toBe(true);
  });

  it('never presents once today is recorded, or without a missed day', () => {
    expect(shouldPresentMissedConsequence({ latestMissedDate: '2026-09-19', acknowledgedMissedDate: null, hasTodayRecord: true })).toBe(false);
    expect(shouldPresentMissedConsequence({ latestMissedDate: null, acknowledgedMissedDate: null, hasTodayRecord: false })).toBe(false);
  });
});
