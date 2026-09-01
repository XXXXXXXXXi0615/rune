/**
 * periodLabels — unified Chinese label resolver for period cycle data.
 * Never display raw internal enums (stormy / rising / menstruation) to users.
 * All unknown values fall back to 「未記錄」.
 */
import { PERIOD_MOODS, TIDE_LEVELS, FLOW_LEVELS } from '@/utils/periodStorage';
import type { CyclePhase } from '@/features/period/getCycleSnapshot';

const MOOD_LABEL_MAP: Record<string, string> = PERIOD_MOODS.reduce(
  (acc, m) => {
    acc[m.key] = m.label;
    return acc;
  },
  {} as Record<string, string>,
);

const TIDE_LABEL_MAP: Record<string, string> = {
  rising: '漲潮',
  high: '滿潮',
  steady: '平潮',
  falling: '退潮',
  low: '低潮',
};

const PHASE_LABEL_MAP: Record<string, string> = {
  'no-data': '尚無資料',
  menstruation: '經期中',
  follicular: '濾泡期',
  ovulation: '排卵期',
  luteal: '黃體期',
  unknown: '週期中',
};

export const FALLBACK_LABEL = '未記錄';

export function getPeriodMoodLabel(value?: string | null): string {
  if (!value) return FALLBACK_LABEL;
  if (MOOD_LABEL_MAP[value]) return MOOD_LABEL_MAP[value];
  return FALLBACK_LABEL;
}

export function getTideLevelLabel(value?: string | null): string {
  if (!value) return FALLBACK_LABEL;
  if (TIDE_LABEL_MAP[value]) return TIDE_LABEL_MAP[value];
  if (TIDE_LEVELS.includes(value)) return value;
  return FALLBACK_LABEL;
}

export function getCyclePhaseLabel(value?: string | null): string {
  if (!value) return FALLBACK_LABEL;
  if (PHASE_LABEL_MAP[value]) return PHASE_LABEL_MAP[value];
  return FALLBACK_LABEL;
}

export function getFlowLevelLabel(value?: string | null): string {
  if (!value) return FALLBACK_LABEL;
  if (FLOW_LEVELS.includes(value)) return value;
  return FALLBACK_LABEL;
}
