/**
 * Phase 3.2 — Symptom Tag Parser
 *
 * Local-only text-to-tags parser. No AI dependency.
 * Splits by common delimiters, trims, deduplicates, and enforces limits.
 */

const MAX_TAG_LENGTH = 12; // max Chinese characters per tag
const MAX_TAGS = 12;

/** Delimiters that split raw text into tag candidates */
const SPLIT_RE = /[,，、。；;／/\n\r]+/;

/**
 * Parse raw symptom text into deduplicated, normalized tags.
 * Returns empty array for empty input.
 */
export function parseSymptomTags(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const candidates = rawText
    .split(SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);

  // Unicode normalize NFC (canonical composition)
  // Case-insensitive dedupe via Set
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const c of candidates) {
    const normalized = c.normalize('NFC');
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    if (normalized.length > MAX_TAG_LENGTH) continue;
    seen.add(lower);
    tags.push(normalized);
    if (tags.length >= MAX_TAGS) break;
  }

  return tags;
}

/**
 * Merge new parsed tags into existing tags.
 * - merge: new tags replace existing
 * - append: new tags appended (deduped)
 */
export function mergeSymptomTags(
  existing: string[],
  newTags: string[],
  mode: 'merge' | 'append' = 'merge',
): string[] {
  const seen = new Set<string>();
  const base = mode === 'append' ? [...existing] : [];
  for (const t of base) seen.add(t.toLowerCase().normalize('NFC'));

  const result = [...base];
  for (const t of newTags) {
    const normalized = t.normalize('NFC');
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    if (normalized.length > MAX_TAG_LENGTH) continue;
    seen.add(lower);
    result.push(normalized);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

export { MAX_TAG_LENGTH, MAX_TAGS };
