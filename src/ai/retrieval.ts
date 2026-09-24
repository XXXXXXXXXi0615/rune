import type { SleepReceipt, FocusSessionEntry, MemoryEntry } from '@/types';

// ── Intent keyword rules ──

interface IntentRule {
  name: string;
  keywords: string[];
  maxItems: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    name: 'Sleep',
    keywords: ['睡眠', '失眠', '累', '疲倦', '睡不好', '睡不著', '沒睡好', '做夢', '熬夜', '早醒', '淺眠'],
    maxItems: 2,
  },
  {
    name: 'Focus',
    keywords: ['專注', '番茄鐘', '工作', '專心', '效率', '分心', '集中', '生產力'],
    maxItems: 2,
  },
  {
    name: 'Memory',
    keywords: ['回憶', '之前', '記得', '那天', '上次', '以前', '那時候', '曾經'],
    maxItems: 1,
  },
  {
    name: 'Timeline',
    keywords: ['最近', '今天', '昨天', '本週', '這週', '這幾天', '近期'],
    maxItems: 2,
  },
];

const MAX_TOTAL_ITEMS = 5;

// ── Format helpers ──

function formatMinutes(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  if (h === 0) return `${m}分鐘`;
  return m === 0 ? `${h}小時` : `${h}h${m}m`;
}

function toDateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Context item builders ──

function buildSleepContext(receipts: SleepReceipt[]): string[] {
  return receipts.slice(0, 2).map((r) => {
    const dur = formatMinutes(r.totalSleep);
    const rem = formatMinutes(r.remMinutes);
    const deep = formatMinutes(r.deepMinutes);
    return `【睡眠】${r.date}：總長 ${dur}，REM ${rem}，深睡 ${deep}，評分 ${r.sleepScore}`;
  });
}

function buildFocusContext(sessions: FocusSessionEntry[]): string[] {
  const recent = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, 2);
  return recent.map((s) => {
    const actual = formatMinutes(s.actualFocusMinutes);
    const rounds = `${s.roundsCompleted}/${s.plannedRounds}`;
    return `【專注】${s.date}：實際 ${actual}，回合 ${rounds}`;
  });
}

function buildMemoryContext_simple(entries: MemoryEntry[]): string[] {
  const recent = entries.slice(0, 3);
  return recent.slice(0, 1).map((e) => {
    const summary = e.summary || e.triggerText || e.scene;
    const label = toDateLabel(e.createdAt);
    return `【記憶】${label}：${summary}`;
  });
}

// ── Main export ──

/**
 * Auto-retrieve relevant context from sleep, focus, and timeline data
 * based on keyword intent detection in the user's message.
 *
 * Returns at most 3-5 context items to avoid prompt explosion.
 */
export function retrieveRelevantContext(
  message: string,
  state: {
    sleepReceipts: SleepReceipt[];
    focusSessionLog: FocusSessionEntry[];
    memoryEntries: MemoryEntry[];
  },
): string {
  const lower = message.toLowerCase();
  const summary: string[] = [];
  const items: string[] = [];

  for (const rule of INTENT_RULES) {
    if (items.length >= MAX_TOTAL_ITEMS) break;
    const matched = rule.keywords.some((kw) => lower.includes(kw));
    if (!matched) continue;

    let groupItems: string[] = [];
    switch (rule.name) {
      case 'Sleep': {
        const sorted = [...(state.sleepReceipts || [])].sort((a, b) => b.createdAt - a.createdAt);
        groupItems = buildSleepContext(sorted).slice(0, rule.maxItems);
        break;
      }
      case 'Focus': {
        groupItems = buildFocusContext(state.focusSessionLog || []).slice(0, rule.maxItems);
        break;
      }
      case 'Memory': {
        const sorted = [...(state.memoryEntries || [])].sort((a, b) => b.createdAt - a.createdAt);
        groupItems = buildMemoryContext_simple(sorted).slice(0, rule.maxItems);
        break;
      }
      case 'Timeline': {
        // Timeline: gather recent sleep and focus context.
        const sleepOne = buildSleepContext(
          [...(state.sleepReceipts || [])].sort((a, b) => b.createdAt - a.createdAt),
        ).slice(0, 1);
        const focusOne = buildFocusContext(state.focusSessionLog || []).slice(0, 1);
        groupItems = [...sleepOne, ...focusOne].slice(0, 2);
        break;
      }
    }

    if (groupItems.length > 0) {
      summary.push(`${rule.name}(${groupItems.length})`);
      items.push(...groupItems);
    }
  }

  // Debug log
  if (summary.length > 0) {
    console.debug('[AI] auto context', { summary: summary.join(' '), items });
  }

  if (items.length === 0) return '';

  return items.slice(0, MAX_TOTAL_ITEMS).join('\n');
}
