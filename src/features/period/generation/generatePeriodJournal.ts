/**
 * generatePeriodJournal — deterministic local Period Journal generator.
 *
 * Contract:
 * - Only uses information that actually exists on the source record.
 * - Never invents pain / sleep / mood causes / medical judgment / advice /
 *   speculative events.
 * - Never emits "undefined", "null", "未填寫" or empty paragraphs.
 * - Same record (same content) → same output. No randomness, no LLM.
 */
import type { PeriodRecord } from '@/utils/periodStorage';
import { getPeriodMoodLabel } from '@/features/period/periodLabels';

export interface PeriodGenerationContext {
  cycleDay?: number;
  phaseLabel?: string;
}

export interface PeriodGeneratedContent {
  title: string;
  body: string;
}

const RAW_ENDING = /([。！？!?．.、]+)$/;

function formatDateLabel(startDate: string): string {
  const [y = '', m = '', d = ''] = startDate.split('-');
  if (!y || !m || !d) return startDate;
  return `${y}/${m}/${d}`;
}

function formatMonthDay(startDate: string): string {
  const [y = '', m = '', d = ''] = startDate.split('-');
  const monthRaw = Number(m);
  const dayRaw = Number(d);
  if (!Number.isFinite(monthRaw) || !Number.isFinite(dayRaw) || monthRaw < 1 || dayRaw < 1) return startDate;
  return `${monthRaw} 月 ${dayRaw} 日`;
}

/** Trim trailing punctuation then close the sentence deterministically. */
function closeSentence(text: string): string {
  const trimmed = text.trim().replace(RAW_ENDING, '');
  return `${trimmed}。`;
}

/**
 * Build the journal body.
 * One sentence per source field, in a fixed order; missing fields are skipped
 * entirely. A minimal record (date only) still yields exactly one sentence.
 */
export function generatePeriodJournal(record: PeriodRecord, ctx: PeriodGenerationContext = {}): PeriodGeneratedContent {
  const sentences: string[] = [];
  const dateLabel = formatDateLabel(record.startDate);
  const monthDay = formatMonthDay(record.startDate);
  const flow = record.flowLevel?.trim();
  const mood = record.mood;
  const rawText = record.symptomRawText?.trim() || '';
  const notes = record.notes?.trim() || '';

  sentences.push(ctx.cycleDay != null
    ? `${monthDay}，週期第 ${ctx.cycleDay} 天。`
    : `${monthDay}的週期紀錄。${ctx.phaseLabel && ctx.phaseLabel !== '未記錄' ? `如今是${ctx.phaseLabel}。` : ''}`);

  if (flow) sentences.push(`今天的經量為${flow}。`);
  if (mood) sentences.push(`情緒偏${getPeriodMoodLabel(mood)}。`);
  if (rawText) sentences.push(`身體狀態：${closeSentence(rawText)}`);
  else if (record.symptoms.length > 0) sentences.push(`已記錄 ${record.symptoms.length} 項症狀。`);
  if (notes) sentences.push(`備註：${closeSentence(notes)}`);

  return {
    title: `週期紀錄 · ${dateLabel}`,
    body: sentences.join(''),
  };
}
