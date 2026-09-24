export interface ParsedSleepData {
  date: string;
  totalSleep?: number;
  awakeMinutes?: number;
  remMinutes?: number;
  coreMinutes?: number;
  deepMinutes?: number;
  sleepStart?: string;
  sleepEnd?: string;
}

function parseDurationMinutes(text: string): number | undefined {
  const hMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|小時|小时)/i);
  const mMatch = text.match(/(\d+)\s*(?:m|min|mins|分鐘|分钟|分)/i);
  let total = 0;
  let found = false;
  if (hMatch) { total += parseFloat(hMatch[1]) * 60; found = true; }
  if (mMatch) { total += parseInt(mMatch[1], 10); found = true; }
  return found ? Math.round(total) : undefined;
}

function parseSleepWindow(text: string): { sleepStart?: string; sleepEnd?: string } {
  // "23:00-07:00" or "11:30pm - 7:15am"
  const t24 = text.match(/([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|~|～|—|–|到|至)\s*([01]?\d|2[0-3]):([0-5]\d)/);
  if (t24) {
    return {
      sleepStart: `${t24[1].padStart(2, '0')}:${t24[2]}`,
      sleepEnd: `${t24[3].padStart(2, '0')}:${t24[4]}`,
    };
  }
  // Chinese: "11點-7點" or "11點半到7點"
  const zh = text.match(/(\d{1,2})\s*點(?:半|(?:\d{1,2})\s*分)?\s*(?:-|~|～|—|–|到|至)\s*(\d{1,2})\s*點(?:半|(?:\d{1,2})\s*分)?/);
  if (zh) {
    const s = parseInt(zh[1], 10);
    const e = parseInt(zh[2], 10);
    return {
      sleepStart: `${String(s).padStart(2, '0')}:00`,
      sleepEnd: `${String(e).padStart(2, '0')}:00`,
    };
  }
  // English: "11pm-7am" or "11 PM to 7 AM"
  const en = text.match(/(\d{1,2})\s*(pm|am|PM|AM)\s*(?:-|~|～|—|–|到|至|to)\s*(\d{1,2})\s*(pm|am|PM|AM)/);
  if (en) {
    let s = parseInt(en[1], 10);
    if (en[2].toLowerCase() === 'pm' && s !== 12) s += 12;
    if (en[2].toLowerCase() === 'am' && s === 12) s = 0;
    let e = parseInt(en[3], 10);
    if (en[4].toLowerCase() === 'pm' && e !== 12) e += 12;
    if (en[4].toLowerCase() === 'am' && e === 12) e = 0;
    return {
      sleepStart: `${String(s).padStart(2, '0')}:00`,
      sleepEnd: `${String(e).padStart(2, '0')}:00`,
    };
  }
  return {};
}

function parseStageValue(text: string, patterns: RegExp[]): number | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseDurationMinutes(m[1]);
      if (val !== undefined) return val;
    }
  }
  return undefined;
}

function parseAppleHealthValue(text: string, label: string): number | undefined {
  const pattern = new RegExp(`${label}[：:]\\s*([^\\n]+)`, 'i');
  const m = text.match(pattern);
  if (m) return parseDurationMinutes(m[1]);
  return undefined;
}

const DEEP_PATTERNS = [
  /深睡(?:眠)?(?:時間)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
  /深層[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
  /deep\s*(?:sleep)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
];

const REM_PATTERNS = [
  /REM[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
  /rem\s*(?:sleep)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
];

const CORE_PATTERNS = [
  /核心(?:睡眠)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
  /core\s*(?:sleep)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
  /輕睡[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
];

const AWAKE_PATTERNS = [
  /清醒[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
  /awake[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
  /醒來\s*(\d+)\s*分鐘/i,
];

export function parseSleepText(rawText: string, fallbackDate?: string): ParsedSleepData {
  const text = rawText.trim();

  // Date
  const dateMatch = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : fallbackDate || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

  // Sleep window
  const window = parseSleepWindow(text);

  // Total sleep duration (from explicit "睡了X小時" type patterns)
  let totalSleep: number | undefined;
  const totalPatterns = [
    /總(?:計|共)?睡(?:眠)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
    /睡了\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|小時|小时)\s*(?:\d+\s*(?:m|min|mins|分鐘|分钟|分))?|\d+\s*(?:m|min|mins|分鐘|分钟|分))/i,
    /sleep(?: duration| time| total)?[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
    /total[：:]?\s*(\d+(?:\.\d+)?\s*(?:h|hr|hrs)\s*(?:\d+\s*(?:m|min|mins))?|\d+\s*(?:m|min|mins))/i,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m) { totalSleep = parseDurationMinutes(m[1]); break; }
  }

  // Also try Apple Health total format
  if (!totalSleep) {
    totalSleep = parseAppleHealthValue(text, '睡眠');
  }

  // Stage breakdown
  const deepMinutes = parseStageValue(text, DEEP_PATTERNS);
  const remMinutes = parseStageValue(text, REM_PATTERNS);
  const coreMinutes = parseStageValue(text, CORE_PATTERNS);
  const awakeMinutes = parseStageValue(text, AWAKE_PATTERNS);

  // Also try Apple Health format for stages
  // Apple Health format: "深層：2h10m REM：1h45m 核心：3h35m 清醒：12m"
  const ahDeep = !deepMinutes ? parseAppleHealthValue(text, '深層') : undefined;
  const ahRem = !remMinutes ? parseAppleHealthValue(text, 'REM') : undefined;
  const ahCore = !coreMinutes ? (parseAppleHealthValue(text, '核心') || parseAppleHealthValue(text, '輕睡')) : undefined;
  const ahAwake = !awakeMinutes ? parseAppleHealthValue(text, '清醒') : undefined;

  // Compute total from stages if not explicitly given
  const stageSum = [ahDeep || deepMinutes || 0, ahRem || remMinutes || 0, ahCore || coreMinutes || 0].reduce((a, b) => a + b, 0);
  if (!totalSleep && stageSum > 0) {
    totalSleep = stageSum;
  }

  return {
    date,
    totalSleep,
    awakeMinutes: awakeMinutes || ahAwake,
    remMinutes: remMinutes || ahRem,
    coreMinutes: coreMinutes || ahCore,
    deepMinutes: deepMinutes || ahDeep,
    sleepStart: window.sleepStart,
    sleepEnd: window.sleepEnd,
  };
}

export function sleepDataToSummary(data: ParsedSleepData): string {
  const parts: string[] = [];
  if (data.totalSleep) {
    const h = Math.floor(data.totalSleep / 60);
    const m = data.totalSleep % 60;
    parts.push(`總睡眠 ${h}h${m > 0 ? m + 'm' : ''}`);
  }
  if (data.sleepStart && data.sleepEnd) parts.push(`${data.sleepStart}–${data.sleepEnd}`);
  if (data.deepMinutes) parts.push(`深睡 ${Math.round(data.deepMinutes)}m`);
  if (data.remMinutes) parts.push(`REM ${Math.round(data.remMinutes)}m`);
  if (data.coreMinutes) parts.push(`核心 ${Math.round(data.coreMinutes)}m`);
  if (data.awakeMinutes) parts.push(`清醒 ${Math.round(data.awakeMinutes)}m`);
  return parts.join(' · ') || '已解析睡眠記錄';
}
