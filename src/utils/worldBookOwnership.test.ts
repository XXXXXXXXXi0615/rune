import { describe, expect, it } from 'vitest';
import type { WorldBookEntry } from '@/types';
import { migrateLegacyWorldBookEntries, parseLegacyWorldBook } from '@/features/worldbook/worldBookOwnership';

const canonical: WorldBookEntry = {
  id: 'canonical-a', title: '既有', content: 'canonical content', keywords: ['alpha'],
  enabled: false, priority: 8, createdAt: 100, updatedAt: 200,
};

describe('Worldbook ownership migration', () => {
  it('preserves legacy content, keyword order, entry order and type metadata', () => {
    const legacy = parseLegacyWorldBook(JSON.stringify([
      { id: 'legacy-a', title: '第一筆', type: 'location', content: 'content A', keywords: ['潮', '月'] },
      { id: 'legacy-b', title: '第二筆', type: 'concept', content: 'content B', keywords: ['夜'] },
    ]));
    const result = migrateLegacyWorldBookEntries([canonical], legacy);
    expect(result.importedCount).toBe(2);
    expect(result.entries.map((entry) => entry.id)).toEqual(['canonical-a', 'legacy-a', 'legacy-b']);
    expect(result.entries[1]).toMatchObject({ content: 'content A', keywords: ['潮', '月'], enabled: true, priority: -1, metadata: { legacyType: 'location' } });
    expect(result.entries[2].priority).toBe(-2);
    expect(result.entries[0]).toEqual(canonical);
  });

  it('is idempotent and deduplicates the same logical entry', () => {
    const legacy = [{ id: 'legacy-a', title: '條目', type: 'character' as const, content: 'same', keywords: ['a', 'b'] }];
    const once = migrateLegacyWorldBookEntries([], legacy).entries;
    const twice = migrateLegacyWorldBookEntries(once, legacy).entries;
    expect(twice).toEqual(once);
    expect(twice).toHaveLength(1);
  });

  it('keeps both records on an id conflict and generates a stable conflict id', () => {
    const legacy = [{ id: 'canonical-a', title: '衝突', type: 'organization' as const, content: 'legacy survives', keywords: ['x'] }];
    const first = migrateLegacyWorldBookEntries([canonical], legacy).entries;
    const second = migrateLegacyWorldBookEntries([canonical], legacy).entries;
    expect(first).toHaveLength(2);
    expect(first[1].id).toMatch(/^legacy-canonical-a-/);
    expect(second[1].id).toBe(first[1].id);
    expect(first[1].content).toBe('legacy survives');
  });

  it('rejects malformed legacy rows without altering valid rows', () => {
    const parsed = parseLegacyWorldBook(JSON.stringify([
      { id: 'ok', title: 'ok', type: 'concept', content: 'exact', keywords: ['k'] },
      { id: 'bad', title: 'bad', type: 'unknown', content: 'bad', keywords: [] },
    ]));
    expect(parsed).toEqual([{ id: 'ok', title: 'ok', type: 'concept', content: 'exact', keywords: ['k'] }]);
  });
});
