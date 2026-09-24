import { describe, expect, it } from 'vitest';
import type { LifeLedgerEntry, LifeLedgerMigrationMeta } from './domain';
import { formatMinorAmount, loadLifeLedgerReadModel } from './readModel';
import { MemoryLifeLedgerRepository } from './repository';

const source = (owner: 'diet' | 'object-memory' | 'money-transaction', legacyId: string) => ({ owner, legacyId, migrationVersion: 2 });
const food = (id: string, occurredAt: string, calories: number): LifeLedgerEntry => ({
  id, type: 'food', title: id, occurredAt, createdAt: occurredAt, source: source('diet', id),
  food: { mealType: 'lunch', status: 'eaten', calories, protein: 10, carbs: 20, fat: 5, water: 100 },
});

async function fixture() {
  const repository = new MemoryLifeLedgerRepository();
  await repository.put('entries', [
    food('food-old', '2026-08-20T12:00:00.000Z', 300),
    food('food-new', '2026-08-22T12:00:00.000Z', 500),
    { id: 'item-1', type: 'item', title: '相機', occurredAt: '2026-08-21T00:00:00.000Z', createdAt: '2026-08-21T00:00:00.000Z', source: source('object-memory', 'item-1'), item: { category: '工具', lifecycleState: 'farewell', startDate: '2025-01-01', usageDays: 600 } },
    { id: 'expense-1', type: 'expense', title: '底片', occurredAt: '2026-08-23T00:00:00.000Z', createdAt: '2026-08-23T00:00:00.000Z', source: source('money-transaction', 'expense-1'), monetary: { amountMinor: 12345, currency: 'TWD', accountId: 'cash', categoryId: 'photo', origin: 'manual' } },
  ]);
  await repository.put('recipes', [{ id: 'recipe-1', source: source('diet', 'recipe-1'), title: '湯', category: '晚餐', ingredients: ['水'], steps: ['煮'], isFavorite: true, createdAt: '2026-08-20', updatedAt: '2026-08-22' }]);
  await repository.put('cooking_logs', [{ id: 'cook-1', source: source('diet', 'cook-1'), title: '煮湯', cookedAt: '2026-08-22T18:00:00.000Z', updatedAt: '2026-08-22T19:00:00.000Z', mealType: 'dinner', ingredients: ['水'], steps: ['煮'], saveAsRecipe: true, recipeId: 'recipe-1' }]);
  await repository.put('item_lifecycle_events', [
    { id: 'event-2', itemEntryId: 'item-1', sequence: 2, source: source('object-memory', 'event-2'), from: 'aging', to: 'farewell', action: 'transitioned', reason: '告別', emotion: '平靜', createdAt: '2026-08-22' },
    { id: 'event-1', itemEntryId: 'item-1', sequence: 1, source: source('object-memory', 'event-1'), from: 'active', to: 'aging', action: 'transitioned', reason: '老化', emotion: '不捨', createdAt: '2026-08-21' },
  ]);
  await repository.put('diet_receipts', [{ id: 'receipt-1', source: source('diet', 'receipt-1'), date: '2026-08-22', mealEntryIds: ['food-new'], totals: { calories: 500, protein: 10, carbs: 20, fat: 5, water: 100 }, viewed: true, createdAt: '2026-08-22', updatedAt: '2026-08-22' }]);
  await repository.put('migration_meta', [{ migrationVersion: 2, schemaVersion: 2, startedAt: '2026-08-22', completedAt: '2026-08-22', verifiedAt: '2026-08-22', status: 'verified', source: [], target: [], verification: { sourceCounts: {}, targetCounts: {}, nutritionTotals: {}, monetaryTotals: {}, lifecycleOrderPreserved: true, readableAssetCount: 0, failedAssetCount: 0, duplicateCount: 0, legacyBytesUnchanged: true, missingRatesRemainUndefined: true, unresolvedRecordCount: 0, errors: [] }, failureSummary: [], cookingLogStrategy: { classification: 'independent', migration: 'canonical cooking_logs store' } } satisfies LifeLedgerMigrationMeta]);
  return repository;
}

describe('Life Ledger canonical read API', () => {
  it('queries by id, type, date and source with deterministic newest-first ordering', async () => {
    const repository = await fixture();
    expect((await repository.getAllEntries()).map((entry) => entry.id)).toEqual(['expense-1', 'food-new', 'item-1', 'food-old']);
    expect((await repository.getEntryById('item-1'))?.title).toBe('相機');
    expect((await repository.getEntriesByType('food')).map((entry) => entry.id)).toEqual(['food-new', 'food-old']);
    expect((await repository.getEntriesByDateRange('2026-08-21', '2026-08-22T23:59:59.999Z')).map((entry) => entry.id)).toEqual(['food-new', 'item-1']);
    expect((await repository.getEntriesBySourceOwner('money-transaction')).map((entry) => entry.id)).toEqual(['expense-1']);
  });

  it('preserves exact lifecycle and canonical relations', async () => {
    const repository = await fixture();
    const lifecycle = await repository.getItemLifecycleByItem('item-1');
    expect(lifecycle.map((event) => `${event.from}->${event.to}`)).toEqual(['active->aging', 'aging->farewell']);
    expect((await repository.getCookingLogs())[0].recipeId).toBe((await repository.getRecipes())[0].id);
    expect((await repository.getDietReceipts())[0].mealEntryIds).toEqual(['food-new']);
    expect((await repository.getMigrationHealth())?.status).toBe('verified');
  });

  it('derives canonical nutrition totals and renders money from minor units', async () => {
    const model = await loadLifeLedgerReadModel(await fixture());
    expect(model.nutritionTotals).toEqual({ calories: 800, protein: 20, carbs: 40, fat: 10, water: 200 });
    expect(formatMinorAmount(12345, 'USD', 'en-US')).toBe('$123.45');
    expect(formatMinorAmount(12345, 'TWD', 'zh-TW')).toContain('123.45');
    expect(model.financeEntries[0].monetary).not.toHaveProperty('exchangeRate');
  });

  it('loads and browses through read methods with zero repository writes', async () => {
    const repository = await fixture();
    let writes = 0;
    const originalPut = repository.put.bind(repository);
    repository.put = async (...args) => { writes += 1; return originalPut(...args); };
    const before = JSON.stringify(await Promise.all(['entries', 'recipes', 'cooking_logs', 'item_lifecycle_events', 'diet_receipts', 'migration_meta'].map((store) => repository.getAll(store as never))));
    await loadLifeLedgerReadModel(repository);
    await repository.getEntryById('food-new');
    await repository.getEntriesByType('food');
    await repository.getEntriesByDateRange('2026-01-01', '2026-12-31');
    const after = JSON.stringify(await Promise.all(['entries', 'recipes', 'cooking_logs', 'item_lifecycle_events', 'diet_receipts', 'migration_meta'].map((store) => repository.getAll(store as never))));
    expect(writes).toBe(0);
    expect(after).toBe(before);
  });
});
