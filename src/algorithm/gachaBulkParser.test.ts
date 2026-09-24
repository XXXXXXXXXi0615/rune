import { describe, expect, it } from 'vitest';
import {
  parseBulkInput,
  buildBulkPreview,
  normalizeTitle,
  type BulkParsedLine,
} from './gachaBulkParser';
import type { GachaItem } from '@/types';

function makeItem(overrides: Partial<GachaItem> & { id: string; title: string }): GachaItem {
  return {
    poolId: 'pool-1',
    weight: 1,
    enabled: true,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('parseBulkInput', () => {
  it('parses plain text lines (format A)', () => {
    const result = parseBulkInput('今天吃火鍋\n今天吃拉麵\n今天吃咖哩');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ title: '今天吃火鍋', weight: 1, weightCorrected: false, rawWeight: null });
    expect(result[1]).toEqual({ title: '今天吃拉麵', weight: 1, weightCorrected: false, rawWeight: null });
    expect(result[2]).toEqual({ title: '今天吃咖哩', weight: 1, weightCorrected: false, rawWeight: null });
  });

  it('parses CRLF line endings', () => {
    const result = parseBulkInput('A\r\nB\r\nC');
    expect(result).toHaveLength(3);
    expect(result.map(r => r.title)).toEqual(['A', 'B', 'C']);
  });

  it('ignores blank lines', () => {
    const result = parseBulkInput('\n  \nA\n\nB\n');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.title)).toEqual(['A', 'B']);
  });

  it('parses pipe-separated weight (format B)', () => {
    const result = parseBulkInput('今天吃火鍋 | 3\n今天吃拉麵 | 1\n今天吃咖哩 | 2');
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('今天吃火鍋');
    expect(result[0].weight).toBe(3);
    expect(result[1].weight).toBe(1);
    expect(result[2].weight).toBe(2);
  });

  it('parses tab-separated weight (format C)', () => {
    const result = parseBulkInput('今天吃火鍋\t3\n今天吃拉麵\t1');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('今天吃火鍋');
    expect(result[0].weight).toBe(3);
    expect(result[1].weight).toBe(1);
  });

  it('treats non-numeric pipe content as title (no pipe format)', () => {
    const result = parseBulkInput('今天吃火鍋, 配菜');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('今天吃火鍋, 配菜');
    expect(result[0].weight).toBe(1);
  });

  it('corrects invalid weight to 1', () => {
    const result = parseBulkInput('A | abc');
    expect(result[0].weight).toBe(1);
    expect(result[0].weightCorrected).toBe(true);
  });

  it('corrects zero weight to 1', () => {
    const result = parseBulkInput('A | 0');
    expect(result[0].weight).toBe(1);
    expect(result[0].weightCorrected).toBe(true);
  });

  it('corrects negative weight to 1', () => {
    const result = parseBulkInput('A | -5');
    expect(result[0].weight).toBe(1);
    expect(result[0].weightCorrected).toBe(true);
  });

  it('rounds float weight', () => {
    const result = parseBulkInput('A | 2.7');
    expect(result[0].weight).toBe(3);
    expect(result[0].weightCorrected).toBe(true);
  });

  it('preserves integer weight without correction', () => {
    const result = parseBulkInput('A | 5');
    expect(result[0].weight).toBe(5);
    expect(result[0].weightCorrected).toBe(false);
  });

  it('handles title containing comma correctly', () => {
    const result = parseBulkInput('今天吃火鍋, 配菜');
    expect(result[0].title).toBe('今天吃火鍋, 配菜');
  });

  it('returns empty array for empty input', () => {
    expect(parseBulkInput('')).toHaveLength(0);
    expect(parseBulkInput('   ')).toHaveLength(0);
  });

  it('rejects input exceeding 200 lines at parse level', () => {
    const lines = Array.from({ length: 210 }, (_, i) => `Item ${i + 1}`);
    const result = parseBulkInput(lines.join('\n'));
    expect(result).toHaveLength(210);
  });
});

describe('normalizeTitle', () => {
  it('normalizes NFC and lowercases', () => {
    expect(normalizeTitle('  Hello  ')).toBe('hello');
    expect(normalizeTitle('こんにちは')).toBe('こんにちは');
  });

  it('trims whitespace', () => {
    expect(normalizeTitle('  test  ')).toBe('test');
  });
});

describe('buildBulkPreview', () => {
  const existingItems: GachaItem[] = [
    makeItem({ id: 'e1', title: 'existing item' }),
    makeItem({ id: 'e2', title: '另一個' }),
  ];

  it('detects new vs duplicate items', () => {
    const parsed = parseBulkInput('existing item\n新項目\n另一個');
    const preview = buildBulkPreview(parsed, existingItems);
    expect(preview.newCount).toBe(1);
    expect(preview.duplicateCount).toBe(2);
    expect(preview.lines[0].status).toBe('duplicate');
    expect(preview.lines[0].existingItemId).toBe('e1');
    expect(preview.lines[1].status).toBe('new');
    expect(preview.lines[2].status).toBe('duplicate');
    expect(preview.lines[2].existingItemId).toBe('e2');
  });

  it('detects duplicates within the batch itself', () => {
    const parsed = parseBulkInput('same item\nsame item');
    const preview = buildBulkPreview(parsed, []);
    expect(preview.newCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.lines[0].status).toBe('new');
    expect(preview.lines[1].status).toBe('duplicate');
  });

  it('detects weight corrections', () => {
    const parsed = parseBulkInput('new item | 0\nok item | 3');
    const preview = buildBulkPreview(parsed, []);
    expect(preview.correctedCount).toBe(1);
    expect(preview.lines[0].status).toBe('weight-corrected');
    expect(preview.lines[0].weight).toBe(1);
    expect(preview.lines[1].status).toBe('new');
    expect(preview.lines[1].weight).toBe(3);
  });

  it('marks over-limit input', () => {
    const lines = Array.from({ length: 201 }, (_, i) => `Item ${i + 1}`);
    const parsed = parseBulkInput(lines.join('\n'));
    const preview = buildBulkPreview(parsed, []);
    expect(preview.overLimit).toBe(true);
    expect(preview.invalidCount).toBe(1);
    expect(preview.lines).toHaveLength(200);
  });

  it('Unicode normalization catches near-duplicates', () => {
    const items = [makeItem({ id: 'u1', title: 'café' })];
    // 'café' with combining accent vs precomposed
    const parsed = parseBulkInput('cafe\u0301');
    const preview = buildBulkPreview(parsed, items);
    expect(preview.duplicateCount).toBe(1);
  });

  it('case insensitive duplicate detection', () => {
    const items = [makeItem({ id: 'c1', title: 'Hello World' })];
    const parsed = parseBulkInput('hello world');
    const preview = buildBulkPreview(parsed, items);
    expect(preview.duplicateCount).toBe(1);
  });
});
