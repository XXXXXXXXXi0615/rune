import type { WorldBookEntry, WorldBookEntryMetadata } from '@/types';

export const LEGACY_WORLDBOOK_STORAGE_KEY = 'lunartide_worldbook_v1';
export const WORLDBOOK_MIGRATION_VERSION = 1;

export type LegacyWorldBookEntryType = 'location' | 'character' | 'organization' | 'concept';
export interface LegacyWorldBookEntry { id: string; title: string; type: LegacyWorldBookEntryType; content: string; keywords: string[]; }
export interface WorldBookMigrationResult { entries: WorldBookEntry[]; importedCount: number; deduplicatedCount: number; }

function isLegacyType(value: unknown): value is LegacyWorldBookEntryType {
  return value === 'location' || value === 'character' || value === 'organization' || value === 'concept';
}

export function parseLegacyWorldBook(raw: string | null): LegacyWorldBookEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is LegacyWorldBookEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<LegacyWorldBookEntry>;
      return typeof candidate.id === 'string' && typeof candidate.title === 'string'
        && typeof candidate.content === 'string' && Array.isArray(candidate.keywords)
        && candidate.keywords.every((keyword) => typeof keyword === 'string') && isLegacyType(candidate.type);
    });
  } catch { return []; }
}

function fingerprint(entry: Pick<WorldBookEntry, 'title' | 'content' | 'keywords'>): string {
  return JSON.stringify([entry.title, entry.content, [...entry.keywords].sort()]);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
}

function mergeLegacyMetadata(entry: WorldBookEntry, type: LegacyWorldBookEntryType): WorldBookEntry {
  if (entry.metadata?.legacyType) return entry;
  return { ...entry, metadata: { ...entry.metadata, legacyType: type } };
}

/** Pure, additive and idempotent legacy-to-canonical migration. */
export function migrateLegacyWorldBookEntries(canonicalEntries: WorldBookEntry[], legacyEntries: LegacyWorldBookEntry[]): WorldBookMigrationResult {
  const entries: WorldBookEntry[] = canonicalEntries.map((entry) => ({ ...entry, keywords: [...entry.keywords], metadata: entry.metadata ? { ...entry.metadata } : undefined }));
  let importedCount = 0;
  let deduplicatedCount = 0;
  const lowestPriority = entries.reduce((lowest, entry) => Math.min(lowest, entry.priority), 0);

  legacyEntries.forEach((legacy, index) => {
    const semanticKey = fingerprint(legacy);
    const semanticIndex = entries.findIndex((entry) => fingerprint(entry) === semanticKey);
    if (semanticIndex >= 0) {
      entries[semanticIndex] = mergeLegacyMetadata(entries[semanticIndex], legacy.type);
      deduplicatedCount += 1;
      return;
    }
    const id = entries.some((entry) => entry.id === legacy.id) ? `legacy-${legacy.id}-${stableHash(semanticKey)}` : legacy.id;
    entries.push({ id, title: legacy.title, content: legacy.content, keywords: [...legacy.keywords], enabled: true,
      priority: lowestPriority - index - 1, createdAt: 0, updatedAt: 0, metadata: { legacyType: legacy.type } });
    importedCount += 1;
  });
  return { entries, importedCount, deduplicatedCount };
}
