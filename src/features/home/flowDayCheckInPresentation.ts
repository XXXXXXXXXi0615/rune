import { calculateFlowDayClock, type FiveElement, type FlowDayPillar } from '@/calendar/core';
import type { CheckInRecord } from '@/features/tideclock/types';

const ELEMENT_LABELS: Readonly<Record<FiveElement, string>> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

export type FlowDayCheckInStatus = 'pending' | 'completed' | 'late';

export interface FlowDayCheckInPresentation {
  dayPillar: FlowDayPillar;
  stemElementLabel: string;
  branchElementLabel: string;
  calendarContext: string;
  status: FlowDayCheckInStatus;
  statusLabel: string;
  ariaLabel: string;
}

export function elementLabel(element: FiveElement): string {
  return ELEMENT_LABELS[element];
}

export function resolveFlowDayCheckInStatus(record?: CheckInRecord): FlowDayCheckInStatus {
  if (!record?.clockInAt || (record.status !== 'completed' && record.status !== 'late')) return 'pending';
  return record.status === 'late' || record.isLate ? 'late' : 'completed';
}

export function buildFlowDayCheckInPresentation(now: Date, record?: CheckInRecord): FlowDayCheckInPresentation {
  const flowDay = calculateFlowDayClock(now);
  const { dayPillar, monthPillar, solarTerm } = flowDay;
  const stemElementLabel = elementLabel(dayPillar.stemElement);
  const branchElementLabel = elementLabel(dayPillar.branchElement);
  const status = resolveFlowDayCheckInStatus(record);
  const statusLabel = status === 'pending' ? '尚未留下今日潮印' : status === 'late' ? '已留下今日潮印，遲到' : '已留下今日潮印';
  const calendarContext = `${solarTerm} · ${monthPillar.branch}月`;

  return {
    dayPillar,
    stemElementLabel,
    branchElementLabel,
    calendarContext,
    status,
    statusLabel,
    ariaLabel: `今日流日${dayPillar.label}，天干${dayPillar.stem}，五行${stemElementLabel}，地支${dayPillar.branch}，主五行${branchElementLabel}，${calendarContext}，${statusLabel}`,
  };
}
