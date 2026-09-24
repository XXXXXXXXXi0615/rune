import { getCycleDateProjection, type CyclePhase } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import type { PeriodRecord } from '@/utils/periodStorage';

export interface CalendarPeriodMetadata {
  date: string;
  recordId: string | null;
  cycleDay: number | null;
  cycleLength: number | null;
  actualPeriodDay: number | null;
  predictedPeriodDay: number | null;
  isFertileWindow: boolean;
  isOvulationDay: boolean;
  phase: CyclePhase;
  phaseLabel: string;
  hasMoodRecord: boolean;
  hasSymptomRecord: boolean;
  hasPeriodData: boolean;
  accessibleLabels: string[];
}

function recordCoversDate(record: PeriodRecord, date: string): boolean {
  return record.startDate <= date && record.endDate >= date;
}

export function resolveCalendarPeriodMetadata(date: string, records: readonly PeriodRecord[]): CalendarPeriodMetadata {
  const ownedRecords = [...records];
  const projection = getCycleDateProjection(date, ownedRecords);
  const record = ownedRecords.find((item) => recordCoversDate(item, date));
  const hasMoodRecord = Boolean(record?.mood);
  const hasSymptomRecord = Boolean(record && ((record.symptomTags?.length ?? 0) > 0 || record.symptoms.length > 0 || record.symptomRawText?.trim()));
  const accessibleLabels: string[] = [];
  if (projection.actualPeriodDay) accessibleLabels.push(`月經第 ${projection.actualPeriodDay} 天`);
  else if (projection.predictedPeriodDay) accessibleLabels.push(`預測月經第 ${projection.predictedPeriodDay} 天`);
  if (projection.isPredictedOvulation) accessibleLabels.push('預測排卵日');
  else if (projection.isFertileWindow) accessibleLabels.push('排卵期');
  if (hasMoodRecord) accessibleLabels.push('有心情紀錄');
  if (hasSymptomRecord) accessibleLabels.push('有症狀紀錄');

  return {
    date,
    recordId: record?.id ?? null,
    cycleDay: projection.cycleDay,
    cycleLength: projection.cycleLength,
    actualPeriodDay: projection.actualPeriodDay,
    predictedPeriodDay: projection.predictedPeriodDay,
    isFertileWindow: projection.isFertileWindow,
    isOvulationDay: projection.isPredictedOvulation,
    phase: projection.phase,
    phaseLabel: getCyclePhaseLabel(projection.phase),
    hasMoodRecord,
    hasSymptomRecord,
    hasPeriodData: projection.phase !== 'no-data' && projection.phase !== 'unknown',
    accessibleLabels,
  };
}
