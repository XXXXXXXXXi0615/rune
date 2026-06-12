import type { HealthRecordQuality, ScreenTimeApp } from '@/types';
import { toLocalDateString } from '@/utils/date';

export interface ParsedSleepLog {
  date: string;
  sleepStart?: string;
  sleepEnd?: string;
  sleepDurationMinutes?: number;
  deepSleepMinutes?: number;
  wakeCount?: number;
  quality: HealthRecordQuality;
  mood: 'tired' | 'calm';
}

function parseDuration(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*(?:h|hr|hrs|小時|小时)\s*(?:(\d{1,2})\s*(?:m|min|mins|分(?:鐘|钟)?))?/i)
    || text.match(/(\d{1,3})\s*(?:m|min|mins|分(?:鐘|钟)?)/i);
  if (!match) return undefined;
  if (/^(?:\d{1,3})\s*(?:m|min|mins|分)/i.test(match[0])) return Number(match[1]);
  return Number(match[1]) * 60 + Number(match[2] || 0);
}

function durationBetween(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

export function parseSleepLog(rawText: string, fallbackDate = toLocalDateString()): ParsedSleepLog {
  const text = rawText.trim();
  const range = text.match(/([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|~|～|—|–|到|至)\s*([01]?\d|2[0-3]):([0-5]\d)/);
  const sleepStart = range ? `${range[1].padStart(2, '0')}:${range[2]}` : undefined;
  const sleepEnd = range ? `${range[3].padStart(2, '0')}:${range[4]}` : undefined;

  const deepMatch = text.match(/深睡(?:眠)?\s*((?:\d{1,2}\s*(?:h|hr|hrs|小時|小时)\s*(?:\d{1,2}\s*(?:m|min|mins|分(?:鐘|钟)?))?|\d{1,3}\s*(?:m|min|mins|分(?:鐘|钟)?)))/i);
  const deepSegment = deepMatch?.[1] || '';
  const deepSleepMinutes = deepSegment ? parseDuration(deepSegment) : undefined;
  const textWithoutDeepSleep = deepMatch ? text.replace(deepMatch[0], ' ') : text;
  const explicitDuration = parseDuration(textWithoutDeepSleep);
  const sleepDurationMinutes = explicitDuration
    ?? (sleepStart && sleepEnd ? durationBetween(sleepStart, sleepEnd) : undefined);

  const wakeMatch = text.match(/(?:醒來|醒来|清醒|夜醒)\s*(\d+)\s*次/i)
    || text.match(/(\d+)\s*次\s*(?:醒來|醒来|清醒|夜醒)/i);
  const wakeCount = wakeMatch ? Number(wakeMatch[1]) : undefined;
  const dateMatch = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : fallbackDate;

  const poor = /很累|疲憊|疲惫|睡不好|失眠|很差|糟|頭痛|头痛/i.test(text);
  const good = /睡得好|睡很好|精神很好|有精神|睡飽|睡饱|品質好|质量好/i.test(text);
  const quality: HealthRecordQuality = poor ? 'poor' : good ? 'good' : 'normal';

  return {
    date,
    sleepStart,
    sleepEnd,
    sleepDurationMinutes,
    deepSleepMinutes,
    wakeCount,
    quality,
    mood: poor ? 'tired' : 'calm',
  };
}

export function formatSleepDuration(minutes?: number): string {
  if (!Number.isFinite(minutes) || !minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

export function buildSleepSummary(parsed: ParsedSleepLog): string {
  const parts: string[] = [];
  const duration = formatSleepDuration(parsed.sleepDurationMinutes);
  if (duration) parts.push(`睡了 ${duration}`);
  if (parsed.wakeCount !== undefined) parts.push(`醒來 ${parsed.wakeCount} 次`);
  if (parsed.deepSleepMinutes !== undefined) parts.push(`深睡 ${formatSleepDuration(parsed.deepSleepMinutes)}`);
  return parts.join(' · ') || '已匯入睡眠日誌';
}

// ── Screen Time ──

export interface ParsedScreenTime {
  date: string;
  totalMinutes?: number;
  apps: ScreenTimeApp[];
  quality: HealthRecordQuality;
}

/** Parse screen time text like "總螢幕時間：7小時32分鐘\n最常用 App：\n小紅書 2小時10分鐘\n微信 1小時20分鐘" */
export function parseScreenTime(rawText: string, fallbackDate = toLocalDateString()): ParsedScreenTime {
  const text = rawText.trim();
  const apps: ScreenTimeApp[] = [];
  let totalMinutes: number | undefined;

  // Parse total time: "總螢幕時間：7小時32分鐘" or "螢幕時間 7h32m" or "7小時32分鐘"
  const totalMatch = text.match(/(?:總)?螢幕(?:使用)?(?:時間|時長)[：:]\s*(.+)/i)
    || text.match(/screen\s*time[：:]\s*(.+)/i);
  if (totalMatch) {
    totalMinutes = parseDuration(totalMatch[1]);
  }
  if (!totalMinutes) {
    // Try to find duration directly: "7小時32分鐘" or "7h32m"
    const directMatch = text.match(/(\d{1,2})\s*(?:h|hr|hrs|小時|小时)\s*(?:(\d{1,2})\s*(?:m|min|mins|分(?:鐘|钟)?))?/i);
    if (directMatch) {
      totalMinutes = parseDuration(directMatch[0]);
    }
  }

  // Parse individual apps: lines like "小紅書 2小時10分鐘" or "微信 1h20m" or "Chrome 58分鐘"
  const appLines = text.split(/[\n\r]+/);
  for (const line of appLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/總|螢幕|screen|最常用|常用|top|apps/i.test(trimmed)) continue;

    // Match "App名 時長" pattern
    const appMatch = trimmed.match(/^(.+?)\s+(\d{1,2}\s*(?:h|hr|hrs|小時|小时)\s*(?:\d{1,2}\s*(?:m|min|mins|分(?:鐘|钟)?))?|\d{1,3}\s*(?:m|min|mins|分(?:鐘|钟)?))$/i);
    if (appMatch) {
      const name = appMatch[1].trim();
      const duration = parseDuration(appMatch[2]);
      if (duration && name.length > 0 && name.length < 40) {
        apps.push({ name, durationMinutes: duration });
      }
    }
  }

  // Quality assessment
  const poor = totalMinutes && totalMinutes > 480; // >8h screen time
  const good = totalMinutes && totalMinutes < 180; // <3h

  return {
    date: fallbackDate,
    totalMinutes,
    apps,
    quality: poor ? 'poor' : good ? 'good' : 'normal',
  };
}

export function buildScreenSummary(parsed: ParsedScreenTime): string {
  const parts: string[] = [];
  if (parsed.totalMinutes !== undefined) {
    parts.push(`今日螢幕使用 ${formatSleepDuration(parsed.totalMinutes)}`);
  }
  if (parsed.apps.length > 0) {
    const top = parsed.apps[0];
    parts.push(`${top.name} 使用時間最高`);
  }
  return parts.join('，') || '已匯入螢幕使用記錄';
}

export function buildScreenTags(parsed: ParsedScreenTime): string[] {
  const tags: string[] = ['健康', '螢幕時間', '數位習慣'];
  for (const app of parsed.apps.slice(0, 3)) {
    if (!tags.includes(app.name)) tags.push(app.name);
  }
  return tags;
}
