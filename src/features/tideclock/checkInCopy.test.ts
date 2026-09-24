import { describe, it, expect } from 'vitest';
import { buildCheckInCopy, buildStreakReaction, type CheckInCopyContext } from './checkInCopy';

function baseCtx(over: Partial<CheckInCopyContext> = {}): CheckInCopyContext {
  return {
    monthly: {},
    isDoneToday: false,
    isTodayLate: false,
    missedDays: [],
    now: new Date(2025, 6, 15, 9, 0, 0), // 2025-07-15 09:00
    ...over,
  };
}

describe('buildCheckInCopy — 动态文案决策表', () => {
  it('今天已打卡且準時 → 認可语气', () => {
    const out = buildCheckInCopy(
      baseCtx({ isDoneToday: true, isTodayLate: false }),
    );
    expect(out).toContain('今天已落印');
  });

  it('今天已打卡但遲到 → 嘲諷语气', () => {
    const out = buildCheckInCopy(
      baseCtx({ isDoneToday: true, isTodayLate: true }),
    );
    expect(out).toContain('遲到');
  });

  it('今天沒打卡 + 已過中午 → 催促', () => {
    const out = buildCheckInCopy(
      baseCtx({ now: new Date(2025, 6, 15, 14, 0, 0) }),
    );
    expect(out).toContain('今天輪到你了');
  });

  it('今天沒打卡 + 上午 + 本月 0 打卡 → 開除預警', () => {
    const out = buildCheckInCopy(baseCtx());
    expect(out).toContain('這個月你還沒開始');
  });

  it('漏签 ≥ 已打卡 + 已签到 > 0 → 嘲諷', () => {
    const out = buildCheckInCopy(
      baseCtx({
        monthly: { '2025-07-10': 'completed' },
        missedDays: ['2025-07-12', '2025-07-14'],
      }),
    );
    expect(out).toContain('月潮已記下缺席');
  });

  it('有漏签 + 有打卡 → 條列 22、24 已記錄，26 漏了', () => {
    const out = buildCheckInCopy(
      baseCtx({
        monthly: {
          '2025-07-22': 'completed',
          '2025-07-24': 'completed',
        },
        missedDays: ['2025-07-26'],
      }),
    );
    expect(out).toContain('22、24 已記錄');
    expect(out).toContain('26 漏了');
  });

  it('0 漏签 + ≥1 打卡 → 簡短確認', () => {
    const out = buildCheckInCopy(
      baseCtx({
        monthly: {
          '2025-07-05': 'completed',
          '2025-07-08': 'completed',
          '2025-07-12': 'completed',
        },
        missedDays: [],
      }),
    );
    expect(out).toContain('本月已記 3 天');
  });

  it('deterministic：相同輸入必得相同輸出', () => {
    const ctx = baseCtx({
      monthly: { '2025-07-10': 'completed' },
      missedDays: ['2025-07-12'],
    });
    expect(buildCheckInCopy(ctx)).toBe(buildCheckInCopy(ctx));
  });

  it('裁切漏签至前 3 天', () => {
    const out = buildCheckInCopy(
      baseCtx({
        monthly: {
          '2025-07-10': 'completed',
          '2025-07-11': 'completed',
          '2025-07-12': 'completed',
          '2025-07-13': 'completed',
          '2025-07-14': 'completed',
        },
        missedDays: ['2025-07-05', '2025-07-06', '2025-07-07', '2025-07-08'],
      }),
    );
    expect(out).toContain('5、6、7');
    expect(out).not.toContain('8');
  });
});

describe('buildStreakReaction — 7-day streak reaction resolver', () => {
  const base = { hasHistory: true };
  const cases: Array<[number, boolean, string]> = [
    [1, true, '至少今天沒忘。'],
    [2, true, '第2天。先別急著自我感動。'],
    [3, true, '第3天。先別急著自我感動。'],
    [4, true, '第4天。看起來這次不是三分鐘熱度。'],
    [5, true, '第5天。看起來這次不是三分鐘熱度。'],
    [6, true, '六天了。明天別在最後一格前翻車。'],
    [7, true, '七天。這次可以稍微得意一下。'],
    [9, true, '七天。這次可以稍微得意一下。'],
  ];
  for (const [streak, isDoneToday, expected] of cases) {
    it(`streak ${streak} done=${isDoneToday} → fixed line`, () => {
      expect(buildStreakReaction({ ...base, streak, isDoneToday })).toBe(expected);
    });
  }

  it('ready state before check-in uses continuing / milestone lines', () => {
    expect(buildStreakReaction({ streak: 6, isDoneToday: false, hasHistory: true })).toBe('連續 6 天了。今天報備就滿一週。');
    expect(buildStreakReaction({ streak: 7, isDoneToday: false, hasHistory: true })).toBe('連續 7 天了。別斷在今天。');
    expect(buildStreakReaction({ streak: 4, isDoneToday: false, hasHistory: true })).toBe('連續 4 天。保持住。');
    expect(buildStreakReaction({ streak: 2, isDoneToday: false, hasHistory: true })).toBe('連續 2 天。今天也別斷。');
  });

  it('reset and first-ever contexts', () => {
    expect(buildStreakReaction({ streak: 0, isDoneToday: false, hasHistory: true })).toBe('上次斷了。今天重新算。');
    expect(buildStreakReaction({ streak: 0, isDoneToday: false, hasHistory: false })).toBe('還沒有紀錄。從今天開始算。');
  });

  it('deterministic: same input → same output', () => {
    expect(buildStreakReaction({ streak: 5, isDoneToday: true, hasHistory: true }))
      .toBe(buildStreakReaction({ streak: 5, isDoneToday: true, hasHistory: true }));
  });
});
