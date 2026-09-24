import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryLifeLedgerRepository } from './repository';
import { LifeLedgerMutationService, type LifeLedgerCommand, type MutationResult } from './mutations';
import {
  adaptMealToFoodCommand,
  adaptObjectToItemCommand,
  adaptMoneyToFinancialCommand,
  adaptCookingLogCommand,
  adaptRecipeCommand,
  isAdapterCommand,
} from './adapters';
import type { LifeLedgerEntry, LifeLedgerCookingLog, LifeLedgerRecipe, LifeLedgerDietReceipt, LifeLedgerItemLifecycleEvent } from './domain';

function seedMigration(repo: MemoryLifeLedgerRepository) {
  const source = { owner: 'diet' as const, legacyId: 'meal:1', migrationVersion: 2 };
  const entry: LifeLedgerEntry = {
    id: 'food:migrated:1', type: 'food', title: '月光早餐', occurredAt: '2026-08-25T08:30:00Z',
    createdAt: '2026-08-25T08:30:00Z', source,
    food: { mealType: 'breakfast', status: 'eaten', calories: 420 },
  };
  const item: LifeLedgerEntry = {
    id: 'item:migrated:1', type: 'item', title: '舊相機', occurredAt: '2026-08-24T09:00:00Z',
    createdAt: '2026-08-24T09:00:00Z', source: { owner: 'object-memory', legacyId: 'item:1', migrationVersion: 2 },
    item: { category: '工具', lifecycleState: 'farewell', startDate: '2024-01-01', usageDays: 600 },
  };
  const recipe: LifeLedgerRecipe = {
    id: 'recipe:migrated:1', source, title: '潮汐湯', category: '晚餐',
    ingredients: ['海帶', '水'], steps: ['煮滾'], isFavorite: true,
    createdAt: '2026-08-20', updatedAt: '2026-08-25',
  };
  const cook: LifeLedgerCookingLog = {
    id: 'cook:migrated:1', source, title: '晚餐煮湯', cookedAt: '2026-08-25T18:00:00Z',
    updatedAt: '2026-08-25T19:00:00Z', mealType: 'dinner',
    ingredients: ['海帶', '水'], steps: ['煮滾'], saveAsRecipe: true, recipeId: 'recipe:migrated:1',
  };
  const receipt: LifeLedgerDietReceipt = {
    id: 'receipt:migrated:1', source, date: '2026-08-25', mealEntryIds: ['food:migrated:1'],
    totals: { calories: 420, protein: 18, carbs: 52, fat: 12, water: 300 },
    viewed: true, createdAt: '2026-08-25', updatedAt: '2026-08-25',
  };
  const lifecycle: LifeLedgerItemLifecycleEvent = {
    id: 'life:migrated:1', itemEntryId: 'item:migrated:1', sequence: 1,
    source: { owner: 'object-memory', legacyId: 'life:1', migrationVersion: 2 },
    from: 'active', to: 'aging', action: 'transitioned', reason: '開始老化', emotion: '不捨',
    createdAt: '2026-08-24',
  };
  return repo.put('entries', [entry, item]).then(() =>
    repo.put('recipes', [recipe])).then(() =>
    repo.put('cooking_logs', [cook])).then(() =>
    repo.put('diet_receipts', [receipt])).then(() =>
    repo.put('item_lifecycle_events', [lifecycle]));
}

describe('LifeLedgerMutationService', () => {
  let repo: MemoryLifeLedgerRepository;
  let service: LifeLedgerMutationService;

  beforeEach(() => {
    repo = new MemoryLifeLedgerRepository();
    service = new LifeLedgerMutationService(repo);
  });

  /* ── Validation ── */
  describe('command validation', () => {
    it('rejects CreateFoodEntry without commandId', async () => {
      const result = await service.execute({ type: 'CreateFoodEntry', commandId: '', payload: { title: 'Test', occurredAt: '2026-01-01', food: { mealType: 'breakfast', status: 'eaten' } } });
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('MISSING_COMMAND_ID');
    });

    it('rejects CreateFoodEntry without title', async () => {
      const result = await service.execute({ type: 'CreateFoodEntry', commandId: 'cmd:1', payload: { title: '', occurredAt: '2026-01-01', food: { mealType: 'breakfast', status: 'eaten' } } });
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('MISSING_TITLE');
    });

    it('rejects CreateFinancialEntry with non-finite amountMinor', async () => {
      const result = await service.execute({ type: 'CreateFinancialEntry', commandId: 'cmd:1', payload: { title: 'Test', occurredAt: '2026-01-01', monetary: { amountMinor: NaN, currency: 'TWD', accountId: 'cash', categoryId: 'food', origin: 'manual' } } });
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('INVALID_AMOUNT_MINOR');
    });

    it('rejects UpdateFoodEntry without entityId', async () => {
      const result = await service.execute({ type: 'UpdateFoodEntry', commandId: 'cmd:1', entityId: '', expectedRevision: 1, payload: {} });
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('MISSING_ENTITY_ID');
    });
  });

  /* ── Create Food ── */
  describe('create food', () => {
    it('creates a food entry with revision 1', async () => {
      const result = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:cmd:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten', calories: 300 } },
      });
      expect(result.status).toBe('committed');
      expect(result.revision).toBe(1);
      expect(result.entityId).toBe('food:food:cmd:1');
      const entry = await repo.getById('entries', result.entityId);
      expect(entry).toBeDefined();
      expect(entry!.revision).toBe(1);
      expect(entry!.source.owner).toBe('life-ledger');
    });

    it('rejects duplicate commandId (idempotency)', async () => {
      const cmd: LifeLedgerCommand = {
        type: 'CreateFoodEntry', commandId: 'food:dup:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten' } },
      };
      const r1 = await service.execute(cmd);
      expect(r1.status).toBe('committed');
      const r2 = await service.execute(cmd);
      expect(r2.status).toBe('committed');
      expect(r2.entityId).toBe(r1.entityId);
      const all = await repo.getAll('entries');
      expect(all.filter((e) => e.type === 'food')).toHaveLength(1);
    });
  });

  /* ── Update Food ── */
  describe('update food', () => {
    it('updates food entry and bumps revision', async () => {
      const create = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:u:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten', calories: 300 } },
      });
      const update = await service.execute({
        type: 'UpdateFoodEntry', commandId: 'food:u:2', entityId: create.entityId, expectedRevision: 1,
        payload: { title: '豐盛早餐', food: { calories: 500 } },
      });
      expect(update.status).toBe('committed');
      expect(update.revision).toBe(2);
      const entry = await repo.getById('entries', create.entityId);
      expect(entry!.title).toBe('豐盛早餐');
      expect(entry!.food!.calories).toBe(500);
    });

    it('rejects update with wrong revision (conflict)', async () => {
      const create = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:c:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      const update = await service.execute({
        type: 'UpdateFoodEntry', commandId: 'food:c:2', entityId: create.entityId, expectedRevision: 99,
        payload: { title: '衝突' },
      });
      expect(update.status).toBe('conflict');
      expect(update.errorCode).toBe('REVISION_CONFLICT');
    });

    it('rejects update on deleted entry', async () => {
      const create = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:d:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      await service.execute({ type: 'DeleteFoodEntry', commandId: 'food:d:2', entityId: create.entityId, expectedRevision: 1 });
      const update = await service.execute({
        type: 'UpdateFoodEntry', commandId: 'food:d:3', entityId: create.entityId, expectedRevision: 2,
        payload: { title: '已刪除' },
      });
      expect(update.status).toBe('rejected');
      expect(update.errorCode).toBe('ENTITY_DELETED');
    });
  });

  /* ── Delete Food (soft-delete) ── */
  describe('delete food', () => {
    it('soft-deletes food entry', async () => {
      const create = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:sd:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      const del = await service.execute({ type: 'DeleteFoodEntry', commandId: 'food:sd:2', entityId: create.entityId, expectedRevision: 1 });
      expect(del.status).toBe('committed');
      const entry = await repo.getById('entries', create.entityId);
      expect(entry!.deletedAt).toBeDefined();
      expect(entry!.revision).toBe(2);
    });

    it('rejects double delete', async () => {
      const create = await service.execute({
        type: 'CreateFoodEntry', commandId: 'food:dd:1',
        payload: { title: '早餐', occurredAt: '2026-08-26T08:00:00Z', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      await service.execute({ type: 'DeleteFoodEntry', commandId: 'food:dd:2', entityId: create.entityId, expectedRevision: 1 });
      const del2 = await service.execute({ type: 'DeleteFoodEntry', commandId: 'food:dd:3', entityId: create.entityId, expectedRevision: 2 });
      expect(del2.status).toBe('rejected');
      expect(del2.errorCode).toBe('ENTITY_ALREADY_DELETED');
    });
  });

  /* ── Create Item ── */
  describe('create item', () => {
    it('creates item entry', async () => {
      const result = await service.execute({
        type: 'CreateItemEntry', commandId: 'item:1',
        payload: { title: '新相機', occurredAt: '2026-08-26', item: { category: '電子', lifecycleState: 'active', startDate: '2026-08-26', usageDays: 0 } },
      });
      expect(result.status).toBe('committed');
      expect(result.revision).toBe(1);
    });
  });

  /* ── Append Lifecycle Event (atomic transaction) ── */
  describe('append lifecycle event', () => {
    it('appends event and updates item lifecycle state atomically', async () => {
      await seedMigration(repo);
      const result = await service.execute({
        type: 'AppendItemLifecycleEvent', commandId: 'life:1', itemEntryId: 'item:migrated:1', expectedItemRevision: 1,
        payload: { from: 'farewell', to: 'retired', action: 'transitioned', reason: '正式退役', emotion: '感恩' },
      });
      expect(result.status).toBe('committed');
      expect(result.affectedStores).toContain('entries');
      expect(result.affectedStores).toContain('item_lifecycle_events');
      const item = await repo.getById('entries', 'item:migrated:1');
      expect(item!.item!.lifecycleState).toBe('retired');
      expect(item!.revision).toBe(2);
      const events = await repo.getAll('item_lifecycle_events');
      const newEvent = events.find((e) => e.commandId === 'life:1');
      expect(newEvent).toBeDefined();
      expect(newEvent!.sequence).toBe(2);
    });

    it('rejects when item not found', async () => {
      const result = await service.execute({
        type: 'AppendItemLifecycleEvent', commandId: 'life:bad', itemEntryId: 'nonexistent', expectedItemRevision: 1,
        payload: { to: 'retired', action: 'transitioned', reason: 'test', emotion: 'test' },
      });
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('ITEM_NOT_FOUND');
    });

    it('represents transitions to and from idle without rewriting prior events', async () => {
      const created = await service.execute({
        type: 'CreateItemEntry', commandId: 'item:idle:1',
        payload: { title: '備用相機', occurredAt: '2026-09-10', item: { category: '電子', lifecycleState: 'active', startDate: '2026-09-10', usageDays: 0 } },
      });
      const toIdle = await service.execute({
        type: 'AppendItemLifecycleEvent', commandId: 'life:idle:1', itemEntryId: created.entityId, expectedItemRevision: 1,
        payload: { from: 'active', to: 'idle', action: 'transitioned', reason: '暫停使用', emotion: '平靜' },
      });
      const toActive = await service.execute({
        type: 'AppendItemLifecycleEvent', commandId: 'life:idle:2', itemEntryId: created.entityId, expectedItemRevision: 2,
        payload: { from: 'idle', to: 'active', action: 'transitioned', reason: '重新使用', emotion: '期待' },
      });

      expect(toIdle.status).toBe('committed');
      expect(toActive.status).toBe('committed');
      expect((await repo.getById('entries', created.entityId))?.item?.lifecycleState).toBe('active');
      const events = (await repo.getItemLifecycleByItem(created.entityId)).filter((event) => event.commandId?.startsWith('life:idle:'));
      expect(events.map(({ from, to }) => ({ from, to }))).toEqual([
        { from: 'active', to: 'idle' },
        { from: 'idle', to: 'active' },
      ]);
    });
  });

  /* ── Create Financial ── */
  describe('create financial', () => {
    it('creates expense with minor units (no float)', async () => {
      const result = await service.execute({
        type: 'CreateFinancialEntry', commandId: 'fin:1',
        payload: { title: '底片', occurredAt: '2026-08-26', monetary: { amountMinor: 12345, currency: 'TWD', accountId: 'cash', categoryId: 'photo', origin: 'manual' } },
      });
      expect(result.status).toBe('committed');
      const entry = await repo.getById('entries', result.entityId);
      expect(entry!.monetary!.amountMinor).toBe(12345);
      expect(typeof entry!.monetary!.amountMinor).toBe('number');
      expect(Number.isInteger(entry!.monetary!.amountMinor)).toBe(true);
    });

    it('creates income for positive amountMinor', async () => {
      const result = await service.execute({
        type: 'CreateFinancialEntry', commandId: 'fin:2',
        payload: { title: '稿費', occurredAt: '2026-08-23', monetary: { amountMinor: 500000, currency: 'JPY', accountId: 'bank', categoryId: 'work', origin: 'manual' } },
      });
      expect(result.status).toBe('committed');
      const entry = await repo.getById('entries', result.entityId);
      expect(entry!.type).toBe('income');
    });
  });

  /* ── Create CookingLog ── */
  describe('create cooking log', () => {
    it('creates cooking log with independent provenance', async () => {
      const result = await service.execute({
        type: 'CreateCookingLog', commandId: 'cook:1',
        payload: { title: '煮湯', cookedAt: '2026-08-26T18:00:00Z', mealType: 'dinner', saveAsRecipe: false },
      });
      expect(result.status).toBe('committed');
      const log = await repo.getById('cooking_logs', result.entityId);
      expect(log!.source.owner).toBe('life-ledger');
      expect(log!.revision).toBe(1);
    });
  });

  /* ── Create Recipe ── */
  describe('create recipe', () => {
    it('creates recipe', async () => {
      const result = await service.execute({
        type: 'CreateRecipe', commandId: 'recipe:1',
        payload: { title: '潮汐湯', category: '晚餐', ingredients: ['海帶', '水'], steps: ['煮滾'], isFavorite: true },
      });
      expect(result.status).toBe('committed');
      const recipe = await repo.getById('recipes', result.entityId);
      expect(recipe!.title).toBe('潮汐湯');
    });

    it('hard-deletes recipe', async () => {
      const create = await service.execute({
        type: 'CreateRecipe', commandId: 'recipe:hd:1',
        payload: { title: '潮汐湯', category: '晚餐', ingredients: ['海帶'], steps: ['煮'], isFavorite: false },
      });
      const del = await service.execute({ type: 'DeleteRecipe', commandId: 'recipe:hd:2', entityId: create.entityId, expectedRevision: 1 });
      expect(del.status).toBe('committed');
      const recipe = await repo.getById('recipes', create.entityId);
      expect(recipe).toBeUndefined();
    });
  });

  /* ── Create DietReceipt ── */
  describe('create diet receipt', () => {
    it('creates receipt', async () => {
      const result = await service.execute({
        type: 'CreateDietReceipt', commandId: 'receipt:1',
        payload: { date: '2026-08-26', mealEntryIds: ['food:1'], totals: { calories: 420, protein: 18, carbs: 52, fat: 12, water: 300 }, viewed: false },
      });
      expect(result.status).toBe('committed');
      const receipt = await repo.getById('diet_receipts', result.entityId);
      expect(receipt!.date).toBe('2026-08-26');
    });
  });

  /* ── Backward Compatibility ── */
  describe('backward compatibility with migration entries', () => {
    it('updates migrated entry (no revision) with expectedRevision=1', async () => {
      await seedMigration(repo);
      const result = await service.execute({
        type: 'UpdateFoodEntry', commandId: 'compat:1', entityId: 'food:migrated:1', expectedRevision: 1,
        payload: { title: '更新後的早餐' },
      });
      expect(result.status).toBe('committed');
      expect(result.revision).toBe(2);
    });

    it('soft-deletes migrated entry (no revision) with expectedRevision=1', async () => {
      await seedMigration(repo);
      const result = await service.execute({
        type: 'DeleteFoodEntry', commandId: 'compat:2', entityId: 'food:migrated:1', expectedRevision: 1,
      });
      expect(result.status).toBe('committed');
    });
  });

  /* ── Provenance ── */
  describe('provenance', () => {
    it('native writes use life-ledger source owner', async () => {
      const result = await service.execute({
        type: 'CreateFoodEntry', commandId: 'prov:1',
        payload: { title: '測試', occurredAt: '2026-08-26', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      const entry = await repo.getById('entries', result.entityId);
      expect(entry!.source.owner).toBe('life-ledger');
      expect(entry!.source.legacyId).toBe('');
      expect(entry!.source.migrationVersion).toBe(0);
    });

    it('migrated entries retain original provenance', async () => {
      await seedMigration(repo);
      const entry = await repo.getById('entries', 'food:migrated:1');
      expect(entry!.source.owner).toBe('diet');
      expect(entry!.source.legacyId).toBe('meal:1');
    });
  });

  /* ── No Dual-Write ── */
  describe('no dual-write', () => {
    it('mutation service writes only to life-ledger repository', async () => {
      const result = await service.execute({
        type: 'CreateFoodEntry', commandId: 'dual:1',
        payload: { title: '測試', occurredAt: '2026-08-26', food: { mealType: 'breakfast', status: 'eaten' } },
      });
      expect(result.affectedStores).toEqual(['entries']);
      expect(result.affectedStores).not.toContain('mealEntries');
      expect(result.affectedStores).not.toContain('moneyTransactions');
    });
  });
});

describe('Compatibility Adapters', () => {
  it('adaptMealToFoodCommand produces valid CreateFoodEntry', () => {
    const cmd = adaptMealToFoodCommand({ title: '早餐', mealType: 'breakfast', calories: 300 });
    expect(cmd.type).toBe('CreateFoodEntry');
    expect(cmd.payload.title).toBe('早餐');
    expect(cmd.payload.food.mealType).toBe('breakfast');
    expect(cmd.payload.food.calories).toBe(300);
    expect(isAdapterCommand(cmd)).toBe(true);
  });

  it('adaptObjectToItemCommand produces valid CreateItemEntry', () => {
    const cmd = adaptObjectToItemCommand({ name: '相機', category: '電子', lifecycleState: 'active', startDate: '2024-01-01' });
    expect(cmd.type).toBe('CreateItemEntry');
    expect(cmd.payload.title).toBe('相機');
    expect(cmd.payload.item.usageDays).toBeGreaterThan(0);
    expect(isAdapterCommand(cmd)).toBe(true);
  });

  it('adaptMoneyToFinancialCommand produces valid CreateFinancialEntry', () => {
    const cmd = adaptMoneyToFinancialCommand({ type: 'expense', amountMinor: 12345, currency: 'TWD', accountId: 'cash', categoryId: 'photo', source: 'manual', occurredAt: '2026-08-26' });
    expect(cmd.type).toBe('CreateFinancialEntry');
    expect(cmd.payload.monetary.amountMinor).toBe(12345);
    expect(isAdapterCommand(cmd)).toBe(true);
  });

  it('adaptCookingLogCommand produces valid CreateCookingLog', () => {
    const cmd = adaptCookingLogCommand({ title: '煮湯', mealType: 'dinner' });
    expect(cmd.type).toBe('CreateCookingLog');
    expect(cmd.payload.title).toBe('煮湯');
    expect(isAdapterCommand(cmd)).toBe(true);
  });

  it('adaptRecipeCommand produces valid CreateRecipe', () => {
    const cmd = adaptRecipeCommand({ title: '潮汐湯', category: '晚餐', ingredients: ['海帶'], steps: ['煮'], isFavorite: false });
    expect(cmd.type).toBe('CreateRecipe');
    expect(cmd.payload.title).toBe('潮汐湯');
    expect(isAdapterCommand(cmd)).toBe(true);
  });

  it('adapters perform zero writes', () => {
    const repo = new MemoryLifeLedgerRepository();
    const cmd = adaptMealToFoodCommand({ title: '早餐', mealType: 'breakfast' });
    expect(isAdapterCommand(cmd)).toBe(true);
    repo.getAll('entries').then((entries) => expect(entries).toHaveLength(0));
  });
});
