/**
 * Moon Dew Economy Engine
 * Dual Ledger Phase 1 — money & moon_dew isolation
 */

import type { MoonDewLedgerEntry, MoonDewSource } from '@/types';
import { toLocalDateString } from '@/utils/date';

export const MOON_DEW_RULES = {
  dailyCheckin: 10,
  focusCompleted: 12,
  focusDurationBonusPer25Min: 3,
  focusDurationBonusMax: 12,
  focusBarely: 3,
  focusHonestRecall: 1,
  focusEarlyExit: -4,
  focusAbandoned: -6,
  focusFaking: -8,
  focusOverAdjusting: -2,
  dailyEarnCap: 60,
  dailyLossCap: 20,
  playroomDailyCap: 15,
} as const;

/** Build a stable idempotency key for an event. */
export function moonDewIdempotencyKey(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

/** Check if an idempotency key already exists in the ledger. */
export function hasMoonDewKey(ledger: MoonDewLedgerEntry[], key: string): boolean {
  return ledger.some((e) => e.idempotencyKey === key);
}

/** Cap accounting rules — which sources count toward which cap. */
export const CAP_RULES = {
  /** Focus earnings count toward dailyEarnCap. */
  earnCapSources: ['focus'] as MoonDewSource[],
  /** Focus penalties count toward dailyLossCap. */
  lossCapSources: ['focus'] as MoonDewSource[],
  /** Playroom uses its own independent cap. */
  playroomSource: 'playroom' as MoonDewSource,
  /** Migration entries are excluded from all caps. */
  excludedSources: ['migration' as MoonDewSource],
} as const;

/** Today's earned amount from specified sources (positive entries only). */
export function todayEarnedBySource(ledger: MoonDewLedgerEntry[], includedSources: MoonDewSource[]): number {
  const todayStr = toLocalDateString();
  let total = 0;
  for (const entry of ledger) {
    if (entry.createdAt.slice(0, 10) !== todayStr) continue;
    if (entry.amount <= 0) continue;
    if (!includedSources.includes(entry.source)) continue;
    total += entry.amount;
  }
  return total;
}

/** Today's lost amount from specified sources (absolute value of negative entries). */
export function todayLostBySource(ledger: MoonDewLedgerEntry[], includedSources: MoonDewSource[]): number {
  const todayStr = toLocalDateString();
  let total = 0;
  for (const entry of ledger) {
    if (entry.createdAt.slice(0, 10) !== todayStr) continue;
    if (entry.amount >= 0) continue;
    if (!includedSources.includes(entry.source)) continue;
    total += Math.abs(entry.amount);
  }
  return total;
}

/** Deprecated — use todayEarnedBySource / todayLostBySource with explicit source filtering. */
export function todayMoonDewNet(ledger: MoonDewLedgerEntry[]): { earned: number; lost: number } {
  const todayStr = toLocalDateString();
  let earned = 0;
  let lost = 0;
  for (const entry of ledger) {
    const entryDate = entry.createdAt.slice(0, 10);
    if (entryDate !== todayStr) continue;
    if (entry.amount > 0) earned += entry.amount;
    else lost += Math.abs(entry.amount);
  }
  return { earned, lost };
}

/** Compute total balance from ledger (reversal entries cancel out original). */
export function computeMoonDewBalance(ledger: MoonDewLedgerEntry[]): number {
  let sum = 0;
  for (const entry of ledger) {
    // Reversal entries have negative amount that cancels the original.
    // Both original and reversal are included in the sum.
    sum += entry.amount;
  }
  return Math.max(0, sum);
}

/** Create a ledger entry object (does NOT persist). */
export function buildMoonDewEntry(opts: {
  amount: number;
  source: MoonDewSource;
  reasonCode: string;
  title: string;
  idempotencyKey: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
}): MoonDewLedgerEntry {
  return {
    id: crypto.randomUUID(),
    amount: opts.amount,
    source: opts.source,
    reasonCode: opts.reasonCode,
    title: opts.title,
    relatedEntityId: opts.relatedEntityId,
    idempotencyKey: opts.idempotencyKey,
    metadata: opts.metadata,
    createdAt: new Date().toISOString(),
  };
}

/** Apply daily earn cap to positive settlement entries only.
 *  Negative entries are already capped inline by balance + daily loss cap.
 *  Each entry gets { requestedAmount, appliedAmount, capReason? } in its metadata.
 */
/**
 * Cap positive settlement entries with integer-only proportional distribution.
 * Uses floor + remainder algorithm:
 *   1. Compute floor(entry.amount * earnRemaining / posTotal) for each entry
 *   2. Sum floors, compute remainder = earnRemaining - floorSum
 *   3. Distribute remainder 1-by-1 in original entry order
 *   4. Each appliedAmount is integer, sum === earnRemaining
 *   5. Same input always produces same output
 */
function capPositiveSettlementEntries(
  entries: MoonDewLedgerEntry[],
  todayEarned: number,
): { entries: MoonDewLedgerEntry[]; total: number } {
  const earnRemaining = Math.max(0, MOON_DEW_RULES.dailyEarnCap - todayEarned);

  const posEntries = entries.filter((e) => e.amount > 0);
  const negEntries = entries.filter((e) => e.amount < 0);
  const otherEntries = entries.filter((e) => e.amount === 0);

  const result: MoonDewLedgerEntry[] = [];
  let total = 0;

  for (const e of negEntries) {
    result.push(e);
    total += e.amount;
  }

  const posTotal = posEntries.reduce((s, e) => s + e.amount, 0);

  if (posTotal > 0) {
    if (posTotal <= earnRemaining) {
      for (const e of posEntries) {
        e.metadata = { ...(e.metadata || {}), requestedAmount: e.amount, appliedAmount: e.amount };
        result.push(e);
        total += e.amount;
      }
    } else if (earnRemaining > 0) {
      // Floor-based proportional distribution
      const floors: number[] = [];
      let floorSum = 0;
      for (const e of posEntries) {
        const f = Math.floor(e.amount * earnRemaining / posTotal);
        floors.push(f);
        floorSum += f;
      }
      let remainder = earnRemaining - floorSum;
      for (let i = 0; i < posEntries.length; i++) {
        const e = posEntries[i];
        const requested = e.amount;
        let applied = floors[i];
        if (remainder > 0) {
          applied += 1;
          remainder -= 1;
        }
        if (applied > 0) {
          e.amount = applied;
          e.metadata = { ...(e.metadata || {}), requestedAmount: requested, appliedAmount: applied, capReason: 'daily_earn_cap' };
          result.push(e);
          total += applied;
        }
      }
    }
    // earnRemaining <= 0: skip all positive entries
  }

  return { entries: [...result, ...otherEntries], total };
}

/** Focus session → moon dew settlement (pure function, no side effects). */
export function settleFocusSession(opts: {
  sessionId: string;
  status: 'completed' | 'interrupted' | 'early_exit' | 'abandoned';
  actualFocusMinutes: number;
  flags: {
    overAdjusting?: boolean;
    earlyEscape?: boolean;
    noTaskDefined?: boolean;
    goodRecovery?: boolean;
    honestCompletion?: boolean;
    fakePreparation?: boolean;
  };
  currentBalance?: number;
  todayEarned?: number;
  todayLost?: number;
}): { entries: MoonDewLedgerEntry[]; total: number; clamped: boolean; metadata: Record<string, unknown> } {
  const rawEntries: MoonDewLedgerEntry[] = [];
  let rawTotal = 0;

  // Base settlement key
  const baseKey = moonDewIdempotencyKey('focus', `${opts.sessionId}:settlement`);

  if (opts.status === 'completed') {
    // 守约 — 基础完成奖
    const baseAmount = MOON_DEW_RULES.focusCompleted;
    rawEntries.push(
      buildMoonDewEntry({
        amount: baseAmount,
        source: 'focus',
        reasonCode: 'focus:completed',
        title: '專注完成',
        idempotencyKey: `${baseKey}:completed`,
        relatedEntityId: opts.sessionId,
      }),
    );
    rawTotal += baseAmount;

    // 时长加成 (每 25 分钟 +3，上限 12)
    if (opts.actualFocusMinutes > 0) {
      const bonusUnits = Math.floor(opts.actualFocusMinutes / 25);
      const bonusAmount = Math.min(bonusUnits * MOON_DEW_RULES.focusDurationBonusPer25Min, MOON_DEW_RULES.focusDurationBonusMax);
      if (bonusAmount > 0) {
        rawEntries.push(
          buildMoonDewEntry({
            amount: bonusAmount,
            source: 'focus',
            reasonCode: 'focus:duration_bonus',
            title: `專注時長加成 ${opts.actualFocusMinutes} 分鐘`,
            idempotencyKey: `${baseKey}:duration`,
            relatedEntityId: opts.sessionId,
            metadata: { minutes: opts.actualFocusMinutes },
          }),
        );
        rawTotal += bonusAmount;
      }
    }

    // goodRecovery — 暂停后仍完成
    if (opts.flags.goodRecovery) {
      const amount = MOON_DEW_RULES.focusBarely;
      rawEntries.push(
        buildMoonDewEntry({
          amount,
          source: 'focus',
          reasonCode: 'focus:good_recovery',
          title: '暫停後仍守約',
          idempotencyKey: `${baseKey}:recovery`,
          relatedEntityId: opts.sessionId,
        }),
      );
      rawTotal += amount;
    }

    // honestCompletion
    if (opts.flags.honestCompletion) {
      const amount = MOON_DEW_RULES.focusHonestRecall;
      rawEntries.push(
        buildMoonDewEntry({
          amount,
          source: 'focus',
          reasonCode: 'focus:honest_recall',
          title: '誠實記錄',
          idempotencyKey: `${baseKey}:honest`,
          relatedEntityId: opts.sessionId,
        }),
      );
      rawTotal += amount;
    }
  }

  if (opts.status === 'early_exit' || opts.status === 'abandoned' || opts.status === 'interrupted') {
    // 扣分项 — 取最严重的单一行为，不无限叠加
    let penalty = 0;
    let reasonCode = 'focus:incomplete';
    let title = '專注未完成';

    if (opts.flags.earlyEscape) {
      penalty = MOON_DEW_RULES.focusEarlyExit;
      reasonCode = 'focus:early_exit';
      title = '提早離開';
    } else if (opts.status === 'abandoned') {
      penalty = MOON_DEW_RULES.focusAbandoned;
      reasonCode = 'focus:abandoned';
      title = '放棄專注';
    } else if (opts.flags.fakePreparation) {
      penalty = MOON_DEW_RULES.focusFaking;
      reasonCode = 'focus:faking';
      title = '過度調整';
    } else if (opts.flags.overAdjusting) {
      penalty = MOON_DEW_RULES.focusOverAdjusting;
      reasonCode = 'focus:over_adjusting';
      title = '反覆調參';
    }

    if (penalty < 0) {
      // Balance protection + daily loss cap
      const available = opts.currentBalance ?? 9999;
      const lossRemaining = Math.max(0, MOON_DEW_RULES.dailyLossCap - (opts.todayLost ?? 0));
      const cappedByBalance = Math.min(available, Math.abs(penalty));
      const appliedLoss = Math.min(cappedByBalance, lossRemaining);
      // Always add the full requested penalty to rawTotal
      rawTotal += penalty;
      if (appliedLoss > 0) {
        rawEntries.push(
          buildMoonDewEntry({
            amount: -appliedLoss,
            source: 'focus',
            reasonCode,
            title,
            idempotencyKey: `${baseKey}:penalty`,
            relatedEntityId: opts.sessionId,
            metadata: {
              status: opts.status,
              flags: opts.flags,
              requestedAmount: penalty,
              appliedAmount: -appliedLoss,
              capReason: appliedLoss < Math.abs(penalty)
                ? (lossRemaining < cappedByBalance ? 'daily_loss_cap' : 'balance_protection')
                : undefined,
            },
          }),
        );
      }
    }
  }

  // Apply daily caps for positive entries
  const capResult = capPositiveSettlementEntries(rawEntries, opts.todayEarned ?? 0);

  const metadata = {
    baseReward: opts.status === 'completed' ? MOON_DEW_RULES.focusCompleted : 0,
    durationBonus: rawEntries.find((e) => e.reasonCode === 'focus:duration_bonus')?.amount || 0,
    recoveryBonus: rawEntries.find((e) => e.reasonCode === 'focus:good_recovery')?.amount || 0,
    honestyBonus: rawEntries.find((e) => e.reasonCode === 'focus:honest_recall')?.amount || 0,
    penaltyCode: rawEntries.find((e) => e.amount < 0)?.reasonCode || null,
    requestedAmount: rawTotal,
    appliedAmount: capResult.total,
    appliedCaps: {
      dailyEarnCap: MOON_DEW_RULES.dailyEarnCap,
      dailyLossCap: MOON_DEW_RULES.dailyLossCap,
      todayEarned: opts.todayEarned ?? 0,
      todayLost: opts.todayLost ?? 0,
    },
  };

  return { entries: capResult.entries, total: capResult.total, clamped: capResult.total !== rawTotal, metadata };
}

/** Daily check-in moon dew entry builder. */
export function buildDailyCheckinMoonDew(dateStr: string, streakDay: number): MoonDewLedgerEntry {
  const baseAmount = MOON_DEW_RULES.dailyCheckin;
  const streakBonus = streakDay % 7 === 0 ? 5 : streakDay % 3 === 0 ? 3 : 0;
  const totalAmount = baseAmount + streakBonus;

  return buildMoonDewEntry({
    amount: totalAmount,
    source: 'daily_checkin',
    reasonCode: streakBonus > 0 ? 'checkin:streak_bonus' : 'checkin:daily',
    title: streakBonus > 0 ? `每日簽到 + 連續 ${streakDay} 天獎勵` : '每日簽到',
    idempotencyKey: moonDewIdempotencyKey('checkin', dateStr),
    metadata: { streakDay, baseAmount, streakBonus },
  });
}

/** Playroom grant entry builder (interface only, no game logic). */
export function buildPlayroomMoonDewEntry(opts: {
  eventId: string;
  title: string;
  amount: number;
  achievementId?: string;
}): MoonDewLedgerEntry {
  return buildMoonDewEntry({
    amount: opts.amount,
    source: 'playroom',
    reasonCode: 'playroom:achievement',
    title: opts.title,
    idempotencyKey: moonDewIdempotencyKey('playroom', opts.eventId),
    relatedEntityId: opts.achievementId || opts.eventId,
    metadata: { eventId: opts.eventId, achievementId: opts.achievementId },
  });
}
