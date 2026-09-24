import { getQuestDateKey, type Quest } from '@/store/useQuestStore';
import type { HydrationEntry } from '@/store/useHydrationStore';
import type { FocusSessionEntry } from '@/types';
import type { CheckInRecord } from '@/features/tideclock/types';
import type { VocabularyEntry, VocabularyPracticeRecord } from '@/features/moonlex/types';
import { selectTodayVocabulary } from '@/store/useMoonLexStore';

export const DAILY_SETTLEMENT_STORAGE_KEY = 'lunartide-calendar-daily-settlements-v1';
export const DAILY_SETTLEMENT_VERSION = 1;

export interface DailySettlementLine { key: 'tasks' | 'checkin' | 'focus' | 'hydration' | 'moonlex'; label: string; value: string }
export interface DailySettlementSnapshot { lines: DailySettlementLine[]; emptyMessage?: string }
export interface DailySettlementReceipt {
  id: string; date: string; generatedAt: string; revision: number;
  sourceFingerprint: string; snapshot: DailySettlementSnapshot; previousReceiptId?: string;
}

export interface DailySettlementSources {
  quests: Quest[]; checkIns: CheckInRecord[]; focusSessions: FocusSessionEntry[];
  hydrationEntries: HydrationEntry[]; hydrationTargetMl: number;
  moonlexEntries: VocabularyEntry[]; moonlexPracticeRecords: VocabularyPracticeRecord[];
}

const dateKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function deriveDailySettlement(date: string, sources: DailySettlementSources): { fingerprint: string; snapshot: DailySettlementSnapshot } {
  const lines: DailySettlementLine[] = [];
  const tasks = sources.quests.filter((quest) => getQuestDateKey(quest) === date && quest.status !== 'archived');
  if (tasks.length) {
    const completed = tasks.filter((quest) => quest.status === 'completed').length;
    lines.push({ key: 'tasks', label: 'TIDEQUEST', value: `完成 ${completed} · 未完成 ${tasks.length - completed}` });
  }
  const checkedIn = sources.checkIns.some((record) => record.date === date && record.kind === 'clock_in');
  if (checkedIn) lines.push({ key: 'checkin', label: '打卡', value: '已完成' });
  const focusMinutes = sources.focusSessions.filter((session) => session.date === date).reduce((sum, session) => sum + session.actualFocusMinutes, 0);
  if (focusMinutes > 0) lines.push({ key: 'focus', label: '專注', value: `${focusMinutes} 分鐘` });
  const hydration = sources.hydrationEntries.filter((entry) => entry.dateKey === date).reduce((sum, entry) => sum + entry.amountMl, 0);
  if (hydration > 0) lines.push({ key: 'hydration', label: '飲水', value: `${hydration} / ${sources.hydrationTargetMl} ml` });
  const moonlexCompleted = sources.moonlexPracticeRecords.filter((record) => dateKey(record.reviewedAt) === date).length;
  const moonlexTarget = selectTodayVocabulary({ entries: sources.moonlexEntries, practiceRecords: sources.moonlexPracticeRecords }, new Date(`${date}T12:00:00`).getTime()).length;
  if (moonlexCompleted > 0) lines.push({ key: 'moonlex', label: 'MoonLex', value: `${moonlexCompleted} / ${moonlexTarget}` });
  const snapshot: DailySettlementSnapshot = lines.length ? { lines } : { lines: [], emptyMessage: '今天沒有留下可結算的紀錄。' };
  const canonical = JSON.stringify({ date, snapshot });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) hash = Math.imul(hash ^ canonical.charCodeAt(index), 16777619);
  return { fingerprint: `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`, snapshot };
}

export function loadDailySettlementReceipts(): DailySettlementReceipt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_SETTLEMENT_STORAGE_KEY) || '{}') as { version?: unknown; receipts?: unknown };
    if (parsed.version !== DAILY_SETTLEMENT_VERSION || !Array.isArray(parsed.receipts)) return [];
    return parsed.receipts.filter((receipt): receipt is DailySettlementReceipt => Boolean(receipt && typeof receipt === 'object' && typeof receipt.id === 'string' && typeof receipt.date === 'string' && typeof receipt.sourceFingerprint === 'string'));
  } catch { return []; }
}

export function latestDailySettlement(date: string, receipts = loadDailySettlementReceipts()): DailySettlementReceipt | null {
  return receipts.filter((receipt) => receipt.date === date).sort((a, b) => b.revision - a.revision)[0] ?? null;
}

export function createDailySettlementReceipt(date: string, derived: ReturnType<typeof deriveDailySettlement>, now = new Date()): DailySettlementReceipt {
  const receipts = loadDailySettlementReceipts();
  const previous = latestDailySettlement(date, receipts);
  const receipt: DailySettlementReceipt = {
    id: crypto.randomUUID(), date, generatedAt: now.toISOString(), revision: (previous?.revision ?? 0) + 1,
    sourceFingerprint: derived.fingerprint, snapshot: structuredClone(derived.snapshot), previousReceiptId: previous?.id,
  };
  localStorage.setItem(DAILY_SETTLEMENT_STORAGE_KEY, JSON.stringify({ version: DAILY_SETTLEMENT_VERSION, receipts: [...receipts, receipt] }));
  return receipt;
}
