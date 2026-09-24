import { toLocalDateString } from '@/utils/date';
import type { ReviewDecision, ReviewRecord, ReviewRequestType } from './types';

export interface ReviewReasonInput {
  reason: string;
  nextAction?: string;
  recoveryPlan?: string;
  resumeAt?: string;
  consequenceAcknowledged?: boolean;
}

export interface ReasonValidationResult {
  valid: boolean;
  normalizedReason: string;
  substantiveLength: number;
  reasonCodes: string[];
}

const MIN_LENGTH: Record<number, number> = { 1: 15, 2: 30, 3: 50, 4: 80, 5: 120 };
const FILLER_ONLY = /^(嗯+|啊+|呃+|不知道|沒什麼|隨便|就這樣|略+|同上|沒有原因|不想做)[。！!？?、,s]*$/u;

export function normalizeReason(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function substantiveLength(value: string): number {
  return Array.from(value.replace(/[\s\p{P}\p{S}]/gu, '')).length;
}

function isHighlyRepetitive(value: string): boolean {
  const chars = Array.from(value.replace(/[\s\p{P}\p{S}]/gu, ''));
  if (chars.length < 8) return false;
  const counts = new Map<string, number>();
  chars.forEach((char) => counts.set(char, (counts.get(char) || 0) + 1));
  return Math.max(...counts.values()) / chars.length >= .68;
}

function hasSpecificAction(value?: string): boolean {
  const normalized = normalizeReason(value || '');
  return substantiveLength(normalized) >= 6 && !FILLER_ONLY.test(normalized);
}

export function validateReasonQuality(input: ReviewReasonInput, difficulty: number, recentReasons: string[] = []): ReasonValidationResult {
  const level = Math.max(1, Math.min(5, Math.round(difficulty)));
  const normalizedReason = normalizeReason(input.reason);
  const length = substantiveLength(normalizedReason);
  const reasonCodes: string[] = [];
  if (length < MIN_LENGTH[level]) reasonCodes.push('reason_too_short');
  if (FILLER_ONLY.test(normalizedReason)) reasonCodes.push('filler_only');
  if (isHighlyRepetitive(normalizedReason)) reasonCodes.push('excessive_repetition');
  if (recentReasons.some((reason) => normalizeReason(reason).toLocaleLowerCase('zh-TW') === normalizedReason.toLocaleLowerCase('zh-TW'))) reasonCodes.push('duplicate_recent_reason');
  if (level >= 3 && !hasSpecificAction(input.nextAction)) reasonCodes.push('next_action_required');
  if (level >= 3 && !hasSpecificAction(input.recoveryPlan)) reasonCodes.push('recovery_plan_required');
  if (level >= 4 && (!input.resumeAt || Number.isNaN(Date.parse(input.resumeAt)))) reasonCodes.push('resume_time_required');
  if (level >= 5 && input.consequenceAcknowledged !== true) reasonCodes.push('consequence_acknowledgement_required');
  return { valid: reasonCodes.length === 0, normalizedReason, substantiveLength: length, reasonCodes };
}

export function effectiveReviewDifficulty(baseDifficulty: number, adaptive: boolean, records: ReviewRecord[], now = new Date()): number {
  const base = Math.max(1, Math.min(5, Math.round(baseDifficulty)));
  if (!adaptive) return base;
  const todayCount = records.filter((record) => toLocalDateString(new Date(record.createdAt)) === toLocalDateString(now)).length;
  return Math.min(5, base + Math.floor(todayCount / 2));
}

export interface AdaptiveDifficultyExplanation {
  baseDifficulty: number;
  todayDerivedDifficulty: number;
  delta: number;
  reason: string;
  appliesTodayOnly: true;
  overriddenToBase: boolean;
}

export function selectAdaptiveDifficultyExplanation(baseDifficulty: number, adaptive: boolean, records: ReviewRecord[], now = new Date(), overriddenToBase = false): AdaptiveDifficultyExplanation {
  const base = Math.max(1, Math.min(5, Math.round(baseDifficulty)));
  const todayCount = records.filter((record) => toLocalDateString(new Date(record.createdAt)) === toLocalDateString(now)).length;
  const derived = adaptive && !overriddenToBase ? Math.min(5, base + Math.floor(todayCount / 2)) : base;
  const delta = derived - base;
  return { baseDifficulty: base, todayDerivedDifficulty: derived, delta, reason: !adaptive ? '目前使用固定難度。' : overriddenToBase ? '今天已由你指定使用基礎難度。' : delta > 0 ? `今天已有 ${todayCount} 次審核，因此暫時提高 ${delta} 級。` : '今天的審核次數尚未提高難度。', appliesTodayOnly: true, overriddenToBase };
}

export function decideReview(type: ReviewRequestType, validation: ReasonValidationResult): ReviewDecision {
  if (!validation.valid) return { decision: 'rejected', reasonCode: validation.reasonCodes[0] || 'reason_invalid', message: '理由尚未符合本次審核要求。' };
  if (type === 'abandon') return { decision: 'conditional', reasonCode: 'abandon_requires_acceptance', message: '可以放棄，但要先確認你接受中止這條主線。', conditions: ['確認中止此任務；執行後將依既有失敗規則處理。'] };
  return { decision: 'approved', reasonCode: 'requirements_met', message: '審核通過，可以執行這次調整。' };
}

export function reviewRequirements(difficulty: number): string[] {
  const level = Math.max(1, Math.min(5, Math.round(difficulty)));
  const items = [`至少 ${MIN_LENGTH[level]} 個有效字元`];
  if (level >= 3) items.push('具體下一步', '恢復計畫');
  if (level >= 4) items.push('恢復時間');
  if (level >= 5) items.push('確認已理解可能後果');
  return items;
}
