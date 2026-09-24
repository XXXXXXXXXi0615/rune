import { describe, expect, it } from 'vitest';
import {
  canonicalEntryToObjectMemory,
  getCanonicalIdForObjectMemory,
} from './canonicalItemStore';
import type { LifeLedgerEntry } from './domain';

function makeItemEntry(overrides: Partial<LifeLedgerEntry> = {}): LifeLedgerEntry {
  return {
    id: 'item:test:1',
    type: 'item',
    title: '我的相機',
    occurredAt: '2026-01-15',
    createdAt: '2026-01-15T09:00:00Z',
    source: { owner: 'object-memory', legacyId: 'object-memory:obj-001', migrationVersion: 2 },
    item: {
      category: '工具',
      lifecycleState: 'active',
      startDate: '2026-01-15',
      usageDays: 222,
    },
    ...overrides,
  };
}

describe('canonicalItemStore — pure adapters', () => {
  describe('canonicalEntryToObjectMemory', () => {
    it('maps a canonical item entry to ObjectMemory shape', () => {
      const entry = makeItemEntry();
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj).toBeDefined();
      expect(obj!.name).toBe('我的相機');
      expect(obj!.category).toBe('工具');
      expect(obj!.lifecycleState).toBe('active');
      expect(obj!.startDate).toBe('2026-01-15');
      expect(obj!.usageDays).toBe(222);
    });

    it('strips "object-memory:" prefix from legacyId', () => {
      const entry = makeItemEntry();
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.id).toBe('obj-001');
    });

    it('falls back to entry.id when legacyId is empty', () => {
      const entry = makeItemEntry({
        id: 'item:new:1',
        source: { owner: 'life-ledger', legacyId: '', migrationVersion: 2 },
      });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.id).toBe('item:new:1');
    });

    it('maps lifecycle states correctly', () => {
      const states = ['active', 'idle', 'aging', 'farewell', 'retired'] as const;
      const expected = ['active', 'active', 'aging', 'farewell', 'retired'] as const;
      for (let i = 0; i < states.length; i++) {
        const entry = makeItemEntry({ item: { ...makeItemEntry().item!, lifecycleState: states[i] } });
        const obj = canonicalEntryToObjectMemory(entry);
        expect(obj!.lifecycleState).toBe(expected[i]);
      }
    });

    it('returns undefined for non-item entries', () => {
      const entry = makeItemEntry({ type: 'expense' as LifeLedgerEntry['type'] });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj).toBeUndefined();
    });

    it('returns undefined when item field is missing', () => {
      const entry = makeItemEntry({ item: undefined });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj).toBeUndefined();
    });

    it('preserves notes from entry.notes', () => {
      const entry = makeItemEntry({ notes: '很好的相機' });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.notes).toBe('很好的相機');
    });

    it('defaults notes to empty string when missing', () => {
      const entry = makeItemEntry({ notes: undefined });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.notes).toBe('');
    });

    it('image is undefined (not stored in canonical item)', () => {
      const entry = makeItemEntry();
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.image).toBeUndefined();
    });

    it('converts createdAt string to timestamp number', () => {
      const entry = makeItemEntry({ createdAt: '2026-01-15T09:00:00Z' });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(typeof obj!.createdAt).toBe('number');
      expect(obj!.createdAt).toBe(new Date('2026-01-15T09:00:00Z').getTime());
    });

    it('usageLogs and lifecycleEvents are empty arrays (not in canonical item)', () => {
      const entry = makeItemEntry();
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.usageLogs).toEqual([]);
      expect(obj!.lifecycleEvents).toEqual([]);
    });

    it('defaults category to 未分類 when item.category is empty', () => {
      const entry = makeItemEntry({ item: { ...makeItemEntry().item!, category: '' } });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.category).toBe('未分類');
    });

    it('handles endDate from item', () => {
      const entry = makeItemEntry({ item: { ...makeItemEntry().item!, endDate: '2026-12-31' } });
      const obj = canonicalEntryToObjectMemory(entry);
      expect(obj!.endDate).toBe('2026-12-31');
    });
  });

  describe('getCanonicalIdForObjectMemory', () => {
    it('returns the ID as-is when it starts with "item:"', () => {
      expect(getCanonicalIdForObjectMemory('item:ui:123:abc')).toBe('item:ui:123:abc');
    });

    it('returns the ID as-is when it starts with "life-ledger:"', () => {
      expect(getCanonicalIdForObjectMemory('life-ledger:v1:object-memory:obj-001')).toBe(
        'life-ledger:v1:object-memory:obj-001',
      );
    });

    it('computes canonical ID for a plain ObjectMemory ID', () => {
      expect(getCanonicalIdForObjectMemory('obj-001')).toBe('life-ledger:v1:object-memory:obj-001');
    });

    it('computes canonical ID for a UUID ObjectMemory ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(getCanonicalIdForObjectMemory(uuid)).toBe(`life-ledger:v1:object-memory:${uuid}`);
    });
  });
});
