/**
 * Check-in Panel Dynamic Copy
 *
 * Deterministic 一行動態文案，依本月打卡與漏簽情況輸出不同語氣。
 * 不連網、不取隨機，相同輸入必得相同輸出，便於測試與後續擴充。
 */

import { toLocalDateString } from '@/utils/date';

export interface CheckInCopyContext {
  /** 本月所有日期狀態 map（dateStr -> 'completed' | 'late' | 'makeup_required' | 'pending'） */
  monthly: Record<string, 'completed' | 'late' | 'makeup_required' | 'pending'>;
  /** 今天是否已打卡 */
  isDoneToday: boolean;
  /** 今天是否遲到（已打卡但 isLate=true） */
  isTodayLate: boolean;
  /** 已過去的漏簽日期陣列（不含今天） */
  missedDays: string[];
  /** Date 對象（讓函式 deterministic） */
  now: Date;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayOf(dateStr: string): number {
  return Number(dateStr.split('-')[2]);
}

function summarizeMissed(missedDays: string[]): string {
  if (missedDays.length === 0) return '';
  const days = missedDays.slice(0, 3).map(dayOf);
  return days.join('、');
}

function summarizeChecked(monthly: Record<string, string>): string {
  const days = Object.entries(monthly)
    .filter(([, s]) => s === 'completed' || s === 'late')
    .map(([d]) => dayOf(d))
    .sort((a, b) => a - b)
    .slice(-3);
  return days.join('、');
}

/**
 * 決策優先級（高 → 低）：
 * 1. 今天已打卡 → 讚 / 遲到嘲諷
 * 2. 今天沒打卡 + 已過 deadline → 催促
 * 3. 本月 0 打卡 → 開除預警
 * 4. 本月有漏簽 + 漏簽 ≥ 已打卡 → 嘲諷
 * 5. 本月有漏簽 → 條列
 * 6. 漏簽 = 0 且本月 ≥ 1 → 簡短確認
 * 7. 預設 → 沉默觀察
 */
export function buildCheckInCopy(ctx: CheckInCopyContext): string {
  const { monthly, isDoneToday, isTodayLate, missedDays, now } = ctx;
  const todayStr = toLocalDateString(now);
  const totalChecked = Object.values(monthly).filter(
    (s) => s === 'completed' || s === 'late',
  ).length;
  const totalMissed = missedDays.length;

  // 1. 今天已打卡
  if (isDoneToday) {
    return isTodayLate
      ? '今天遲到了，但至少還算打了卡。'
      : '今天已落印，別得意，明天再說。';
  }

  // 2. 今天沒打卡 + 當下時間已過中午（當作 deadline 提示）
  if (now.getHours() >= 12) {
    return '今天輪到你了，別再拖。';
  }

  // 3. 本月 0 打卡
  if (totalChecked === 0) {
    return '這個月你還沒開始，月潮不替你掩飾。';
  }

  // 4. 漏簽 ≥ 已打卡 且已簽到 > 0
  if (totalMissed > 0 && totalMissed >= totalChecked) {
    return '月潮已記下缺席，不替你粉飾。';
  }

  // 5. 有漏簽 → 條列
  if (totalMissed > 0) {
    const missed = summarizeMissed(missedDays);
    const checked = summarizeChecked(monthly);
    if (missed && checked) {
      return `${checked} 已記錄，${missed} 漏了。`;
    }
    if (missed) {
      return `${missed} 漏了，月潮記著。`;
    }
  }

  // 6. 沒漏簽 + 有打卡
  if (totalChecked > 0 && totalMissed === 0) {
    return totalChecked >= 10
      ? `本月 ${totalChecked} 天全記，別放鬆。`
      : `本月已記 ${totalChecked} 天，繼續。`;
  }

  // 7. 預設
  return `今天 ${todayStr}，月潮在看你。`;
}

/**
 * Streak-track reaction resolver for the 7-day game-style panel.
 * Same seam rules as buildCheckInCopy: deterministic pure function, no model
 * calls, no randomness, output never persisted.
 */
export interface StreakReactionContext {
  /** Current perfect streak (after today's check-in in the success state). */
  streak: number;
  /** true when today already has a clock-in record (success / reopened). */
  isDoneToday: boolean;
  /** Whether any clock-in history exists — exposes the streak-reset context. */
  hasHistory: boolean;
}

export function buildStreakReaction(ctx: StreakReactionContext): string {
  const { streak, isDoneToday, hasHistory } = ctx;
  if (isDoneToday) {
    if (streak >= 7) return '七天。這次可以稍微得意一下。';
    if (streak === 6) return '六天了。明天別在最後一格前翻車。';
    if (streak === 5 || streak === 4) return `第${streak}天。看起來這次不是三分鐘熱度。`;
    if (streak === 3 || streak === 2) return `第${streak}天。先別急著自我感動。`;
    return '至少今天沒忘。';
  }
  if (streak >= 7) return `連續 ${streak} 天了。別斷在今天。`;
  if (streak >= 6) return `連續 ${streak} 天了。今天報備就滿一週。`;
  if (streak >= 4) return `連續 ${streak} 天。保持住。`;
  if (streak >= 1) return `連續 ${streak} 天。今天也別斷。`;
  return hasHistory ? '上次斷了。今天重新算。' : '還沒有紀錄。從今天開始算。';
}
