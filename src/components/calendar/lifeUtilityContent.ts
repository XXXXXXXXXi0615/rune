import type { LifeLedgerDietReceipt, LifeLedgerEntry, LifeLedgerItemLifecycleEvent } from '@/features/lifeLedger/domain';

export type ItemLifecycleState = NonNullable<LifeLedgerEntry['item']>['lifecycleState'];

export const ITEM_LIFECYCLE_STATES: ReadonlyArray<{ id: ItemLifecycleState; label: string }> = [
  { id: 'active', label: '使用中' },
  { id: 'idle', label: '閒置' },
  { id: 'aging', label: '漸老' },
  { id: 'farewell', label: '告別期' },
  { id: 'retired', label: '已退役' },
];

export type ItemLifecycleCounts = Record<ItemLifecycleState, number>;

export interface RecentItemLifecycleChange {
  id: string;
  itemName: string;
  transition: string;
  dateLabel: string;
}

export interface DailyFinanceTotal {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export interface DailyReceiptSummary {
  id: string;
  title: string;
  mealCount: number;
  calories: number;
  viewed: boolean;
  createdAt: string;
}

export function deriveDailyFinanceTotals(entries: LifeLedgerEntry[], selectedDate: string): DailyFinanceTotal[] {
  const totals = new Map<string, DailyFinanceTotal>();
  for (const entry of entries) {
    if (entry.deletedAt || !entry.monetary || entry.occurredAt.slice(0, 10) !== selectedDate) continue;
    const currency = entry.monetary.currency.toUpperCase();
    const total = totals.get(currency) ?? { currency, incomeMinor: 0, expenseMinor: 0, netMinor: 0 };
    if (entry.type === 'income') total.incomeMinor += entry.monetary.amountMinor;
    if (entry.type === 'expense') total.expenseMinor += entry.monetary.amountMinor;
    total.netMinor = total.incomeMinor - total.expenseMinor;
    totals.set(currency, total);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function deriveDailyReceiptSummaries(receipts: LifeLedgerDietReceipt[], selectedDate: string, limit = 3): DailyReceiptSummary[] {
  return receipts
    .filter((receipt) => receipt.date === selectedDate)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map((receipt) => ({
      id: receipt.id,
      title: '生活收據',
      mealCount: receipt.mealEntryIds.length,
      calories: receipt.totals.calories,
      viewed: receipt.viewed,
      createdAt: receipt.createdAt,
    }));
}

const stateLabel = (state: ItemLifecycleState) => ITEM_LIFECYCLE_STATES.find((item) => item.id === state)?.label ?? state;

export function visibleItemEntries(entries: LifeLedgerEntry[]): LifeLedgerEntry[] {
  return entries.filter((entry) => !entry.deletedAt && entry.type === 'item' && entry.item);
}

export function deriveItemLifecycleCounts(entries: LifeLedgerEntry[]): ItemLifecycleCounts {
  const counts: ItemLifecycleCounts = { active: 0, idle: 0, aging: 0, farewell: 0, retired: 0 };
  for (const entry of visibleItemEntries(entries)) counts[entry.item!.lifecycleState] += 1;
  return counts;
}

function shortDate(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日期未記錄';
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return '今天';
  return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(date);
}

export function deriveRecentLifecycleChanges(
  entries: LifeLedgerEntry[],
  events: LifeLedgerItemLifecycleEvent[],
  limit: number,
  now = new Date(),
): RecentItemLifecycleChange[] {
  const names = new Map(visibleItemEntries(entries).map((entry) => [entry.id, entry.title]));
  return [...events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      itemName: names.get(event.itemEntryId) || '物品記錄已移除',
      transition: event.from ? `${stateLabel(event.from)} → ${stateLabel(event.to)}` : stateLabel(event.to),
      dateLabel: shortDate(event.createdAt, now),
    }));
}
