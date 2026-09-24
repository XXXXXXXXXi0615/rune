import type { GachaItem } from '@/types';

const MAX_BULK_ITEMS = 200;

export type DuplicateMode = 'skip' | 'add' | 'merge';

export interface BulkParsedLine {
  title: string;
  weight: number;
  weightCorrected: boolean;
  rawWeight: string | null;
}

export interface BulkPreviewItem {
  title: string;
  weight: number;
  status: 'new' | 'duplicate' | 'weight-corrected';
  existingItemId?: string;
}

export interface BulkPreview {
  lines: BulkPreviewItem[];
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  correctedCount: number;
  overLimit: boolean;
}

export function parseBulkInput(raw: string): BulkParsedLine[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const results: BulkParsedLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let title = trimmed;
    let weightStr: string | null = null;

    // Try tab separator first (format C: spreadsheet paste)
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      title = parts[0].trim();
      weightStr = parts[1]?.trim() ?? null;
    }
    // Try pipe separator (format B)
    else if (trimmed.includes('|')) {
      const lastPipe = trimmed.lastIndexOf('|');
      const before = trimmed.substring(0, lastPipe).trim();
      const after = trimmed.substring(lastPipe + 1).trim();
      title = before;
      weightStr = after || null;
    }

    const parsedWeight = parseWeight(weightStr);
    results.push({
      title,
      weight: parsedWeight.value,
      weightCorrected: parsedWeight.corrected,
      rawWeight: weightStr,
    });
  }

  return results;
}

function parseWeight(raw: string | null): { value: number; corrected: boolean } {
  if (raw === null || raw === '') return { value: 1, corrected: false };
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 1) return { value: 1, corrected: true };
  const rounded = Math.round(num);
  return { value: rounded, corrected: rounded !== num };
}

export function normalizeTitle(title: string): string {
  return title.trim().normalize('NFC').toLowerCase();
}

export function buildBulkPreview(
  parsed: BulkParsedLine[],
  existingItems: readonly GachaItem[],
): BulkPreview {
  const existingMap = new Map<string, GachaItem>();
  for (const item of existingItems) {
    existingMap.set(normalizeTitle(item.title), item);
  }

  const overLimit = parsed.length > MAX_BULK_ITEMS;
  const linesToProcess = overLimit ? parsed.slice(0, MAX_BULK_ITEMS) : parsed;

  const lines: BulkPreviewItem[] = [];
  let newCount = 0;
  let duplicateCount = 0;
  let correctedCount = 0;
  const seenInBatch = new Set<string>();

  for (const line of linesToProcess) {
    const norm = normalizeTitle(line.title);
    const existing = existingMap.get(norm);
    const seenBefore = seenInBatch.has(norm);

    if (existing || seenBefore) {
      lines.push({
        title: line.title,
        weight: line.weight,
        status: 'duplicate',
        existingItemId: existing?.id,
      });
      duplicateCount++;
    } else if (line.weightCorrected) {
      lines.push({ title: line.title, weight: line.weight, status: 'weight-corrected' });
      correctedCount++;
      newCount++;
      seenInBatch.add(norm);
    } else {
      lines.push({ title: line.title, weight: line.weight, status: 'new' });
      newCount++;
      seenInBatch.add(norm);
    }
  }

  return {
    lines,
    newCount,
    duplicateCount,
    invalidCount: overLimit ? parsed.length - MAX_BULK_ITEMS : 0,
    correctedCount,
    overLimit,
  };
}
