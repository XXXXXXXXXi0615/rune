import type { MemoryEntry } from '@/types';

const MAX_ENTRY_CHARS = 160;
const MAX_TOTAL_CHARS = 1200;

export function buildMemoryContext(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';

  const parts: string[] = [];
  for (const entry of entries) {
    const fields: string[] = [];
    if (entry.scene) fields.push(`場景：${entry.scene}`);
    if (entry.triggerText) fields.push(`觸發：${entry.triggerText}`);
    if (entry.bodyThoughts) fields.push(`身體感受：${entry.bodyThoughts}`);
    fields.push(`焦慮：${entry.anxietyLevel}/10`);
    if (entry.nextStep) fields.push(`下一步：${entry.nextStep}`);
    let entryText = fields.join('；');
    if (entryText.length > MAX_ENTRY_CHARS) {
      entryText = entryText.slice(0, MAX_ENTRY_CHARS - 1) + '…';
    }
    parts.push(entryText);
  }

  let context = parts.join('\n');
  if (context.length > MAX_TOTAL_CHARS) {
    context = context.slice(0, MAX_TOTAL_CHARS - 1) + '…';
  }

  return context;
}
