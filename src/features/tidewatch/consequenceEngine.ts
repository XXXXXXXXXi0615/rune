import type { ConsequenceLifecycle, ConsequencePoolItem, TidewatchConsequence } from './types';

const ORDER: ConsequenceLifecycle[] = ['pending', 'revealed', 'active', 'fulfilled'];

export function consequenceSourceEventId(questId: string, dueAt: string): string { return `quest-overdue:${questId}:${dueAt}`; }

export function resolveConsequenceLifecycle(record: TidewatchConsequence, requested: ConsequenceLifecycle): TidewatchConsequence {
  if (ORDER.indexOf(requested) < ORDER.indexOf(record.lifecycle)) return record;
  return { ...record, lifecycle: requested, updatedAt: Math.max(record.updatedAt, Date.now()) };
}

export function eligibleConsequenceItems(pool: ConsequencePoolItem[], intensity: number): ConsequencePoolItem[] {
  const ceiling = Math.max(1, Math.min(5, Math.round(intensity)));
  return pool.filter((item) => item.enabled && item.intensity >= 1 && item.intensity <= ceiling && validateConsequenceSafety(item.title).safe);
}

export function resolveConsequenceSelection(record: TidewatchConsequence, pool: ConsequencePoolItem[], intensity: number, rng: () => number, now = Date.now()): TidewatchConsequence {
  if (record.lifecycle !== 'pending' || record.selectedItemSnapshot) return record;
  const eligible = eligibleConsequenceItems(pool, intensity);
  if (!eligible.length) return record;
  const total = eligible.reduce((sum, item) => sum + Math.max(0, item.weight ?? 1), 0);
  const normalized = Math.max(0, Math.min(0.999999999, rng()));
  let cursor = normalized * (total || eligible.length);
  let selected = eligible[eligible.length - 1];
  for (const item of eligible) {
    cursor -= total ? Math.max(0, item.weight ?? 1) : 1;
    if (cursor < 0) { selected = item; break; }
  }
  return {
    ...record,
    lifecycle: 'revealed',
    selectedItemId: selected.id,
    selectedItemSnapshot: { title: selected.title, intensity: selected.intensity, executionType: selected.executionType, durationMinutes: selected.durationMinutes },
    selectedAt: now,
    updatedAt: now,
  };
}

const UNSAFE_PATTERNS = [
  /自傷|傷害自己|割腕|self[- ]?harm/i,
  /禁食|斷食|不准吃|不准喝|禁止喝水|food restriction|water restriction/i,
  /不准睡|熬夜|睡眠剝奪|sleep deprivation/i,
  /危險行為|危險駕駛|跳樓|dangerous act/i,
  /酗酒|吸毒|藥物濫用|substance use/i,
  /巨額|大額.*(花費|損失|罰款)|large financial loss/i,
  /違法|犯罪|illegal act/i,
  /騷擾|霸凌|羞辱他人|harass/i,
];

export function validateConsequenceSafety(title: string): { safe: boolean; reason?: string } {
  const normalized = title.trim();
  if (!normalized) return { safe: false, reason: '請填寫後果內容。' };
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(normalized))
    ? { safe: false, reason: '這個項目不符合安全規則。' }
    : { safe: true };
}

export function cryptoConsequenceRng(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 0x1_0000_0000;
}

export function shouldFulfillTimerConsequence(record: TidewatchConsequence, settlement: { sessionId: string; outcome: string } | null): boolean {
  return record.lifecycle === 'active'
    && record.selectedItemSnapshot?.executionType === 'timer'
    && Boolean(record.timerSessionId)
    && !!settlement
    && settlement.sessionId === record.timerSessionId
    && settlement.outcome === 'completed';
}
