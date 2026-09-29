/**
 * Phase 1 missed-day consequence — canonical copy and presentation selector.
 *
 * One fixed Rune voice set (no random pool): the leading date token is
 * substituted, the voice never is. Presentation is once per missed day and is
 * acknowledged through the canonical `useCheckInStore.acknowledgedMissedDate`.
 */
import { toLocalDateString } from '@/utils/date';

export interface MissedConsequenceCopy {
  label: string;
  voice: string;
  hint: string;
}

export function buildMissedConsequenceCopy(missedDate: string, now: Date = new Date()): MissedConsequenceCopy {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  const isYesterday = toLocalDateString(yesterday) === missedDate;
  const month = Number(missedDate.slice(5, 7));
  const day = Number(missedDate.slice(8, 10));

  return {
    label: isYesterday ? '昨日漏簽' : `${month}月${day}日漏簽`,
    voice: `「${isYesterday ? '昨天沒來。' : `${month}月${day}日沒來。`}\n『忘了』不是我接受的理由。\n現在，把今天該做的補上。」`,
    hint: '昨日漏簽已保留在報備紀錄中。',
  };
}

export function shouldPresentMissedConsequence(input: {
  latestMissedDate: string | null;
  acknowledgedMissedDate: string | null;
  hasTodayRecord: boolean;
}): boolean {
  if (!input.latestMissedDate || input.hasTodayRecord) return false;
  if (input.acknowledgedMissedDate && input.acknowledgedMissedDate >= input.latestMissedDate) return false;
  return true;
}
