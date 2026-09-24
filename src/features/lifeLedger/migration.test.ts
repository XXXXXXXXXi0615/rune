import { describe, expect, it } from 'vitest';
import { getHomeLauncherModules, getModuleById } from '@/features/navigation/appModuleRegistry';
import { canonicalLifeLedgerId } from './domain';
import { MemoryLifeLedgerRepository } from './repository';
import { runLifeLedgerShadowMigration, type LifeLedgerAssetGateway } from './migration';
import { getLifeLedgerMigrationReport, installLifeLedgerDevAudit } from './diagnostics';
import { loadLifeLedgerReadModel } from './readModel';

function fixture() {
  const pixel = 'data:image/png;base64,iVBORw0KGgo=';
  const app = {
    state: {
      mealEntries: [
        { id: 'meal-1', createdAt: 1000, updatedAt: 1100, mealType: 'lunch', title: '午餐', photo: pixel, calories: 510, protein: 24, carbs: 66, fat: 15, water: 250 },
        { id: 'meal-2', createdAt: 2000, updatedAt: 2100, mealType: 'dinner', title: '晚餐', calories: 430, protein: 20, carbs: 50, fat: 12 },
      ],
      recipes: [{ id: 'recipe-1', title: '湯', category: 'main', ingredients: ['水'], steps: ['煮'], isFavorite: true, createdAt: 1, updatedAt: 2 }],
      cookingLogs: [{ id: 'cook-1', createdAt: 2200, updatedAt: 2300, mealType: 'dinner', title: '實際煮湯', photo: pixel, ingredients: ['水', '鹽'], steps: ['慢煮'], notes: '今天少鹽', tags: ['家常'], saveAsRecipe: false, recipeId: 'recipe-1' }],
      dietReceipts: [{ id: 'receipt-1', type: 'diet_receipt', date: '2026-08-25', mealEntries: [{ id: 'meal-1', createdAt: 1000, updatedAt: 1100, mealType: 'lunch', title: '午餐' }], totals: { calories: 510, protein: 24, carbs: 66, fat: 15, water: 250 }, viewed: false, createdAt: 3000, updatedAt: 3000 }],
      moneyTransactions: [
        { id: 'tx-1', type: 'expense', amountMinor: 12345, currency: 'TWD', accountId: 'cash', categoryId: 'food', source: 'manual', occurredAt: '2026-08-25T10:00:00Z', createdAt: '2026-08-25T10:00:00Z' },
        { id: 'tx-2', type: 'income', amountMinor: 50000, currency: 'TWD', accountId: 'bank', categoryId: 'salary', source: 'import', occurredAt: '2026-08-25T11:00:00Z', createdAt: '2026-08-25T11:00:00Z' },
      ],
      ledgerEntries: [{ id: 'adapter-copy-of-tx-1' }],
    },
  };
  const objects = { state: { objects: [{
    id: 'object-1', name: '舊杯子', image: pixel, category: '杯具', lifecycleState: 'farewell', startDate: '2024-01-01', usageDays: 900, notes: '陪了很久', usageLogs: [], createdAt: 10, updatedAt: 20,
    lifecycleEvents: [
      { id: 'event-1', objectId: 'object-1', to: 'aging', action: 'transitioned', reason: '老化', emotion: 'fond', createdAt: 11 },
      { id: 'event-2', objectId: 'object-1', from: 'aging', to: 'farewell', action: 'transitioned', reason: '告別', emotion: 'bittersweet', createdAt: 12 },
    ],
  }] } };
  return { appRaw: JSON.stringify(app), objectsRaw: JSON.stringify(objects) };
}

function assets(fail = false): LifeLedgerAssetGateway {
  const records = new Map<string, Blob>();
  return {
    async saveWithId(id, blob) { if (fail) throw new Error('write_failed'); records.set(id, blob); },
    async get(id) { return records.get(id) ?? null; },
  };
}

describe('Life Ledger Phase 1A', () => {
  it('removes only the Home profile tile and keeps its module and route', () => {
    expect(getHomeLauncherModules().some((module) => module.id === 'profile')).toBe(false);
    expect(getModuleById('profile')).toMatchObject({ route: '/profile', showInLauncher: false });
  });

  it('migrates legacy owners exactly once with deterministic IDs and no LedgerEntry copy', async () => {
    const snapshot = fixture();
    const repository = new MemoryLifeLedgerRepository();
    const first = await runLifeLedgerShadowMigration({ snapshot, repository, assets: assets(), now: () => new Date('2026-08-26T00:00:00Z') });
    const firstCounts = {
      entries: (await repository.getAll('entries')).length,
      recipes: (await repository.getAll('recipes')).length,
      events: (await repository.getAll('item_lifecycle_events')).length,
      receipts: (await repository.getAll('diet_receipts')).length,
      cooking: (await repository.getAll('cooking_logs')).length,
    };
    const second = await runLifeLedgerShadowMigration({ snapshot, repository, assets: assets(), now: () => new Date('2026-08-26T00:00:00Z') });
    expect(first.status).toBe('verified');
    expect(second.status).toBe('verified');
    expect(first.verification).toMatchObject({
      sourceCounts: { meals: 2, objects: 1, moneyTransactions: 2, ledgerEntriesIgnored: 1 },
      targetCounts: { food: 2, item: 1, financial: 2, recipes: 1, dietReceipts: 1, lifecycleEvents: 2, cookingLogs: 1 },
      nutritionTotals: { calories: 940, protein: 44, carbs: 116, fat: 27, water: 250 },
      monetaryTotals: { 'expense:TWD': 12345, 'income:TWD': 50000 },
      lifecycleOrderPreserved: true, duplicateCount: 0, missingRatesRemainUndefined: true,
    });
    expect({
      entries: (await repository.getAll('entries')).length,
      recipes: (await repository.getAll('recipes')).length,
      events: (await repository.getAll('item_lifecycle_events')).length,
      receipts: (await repository.getAll('diet_receipts')).length,
      cooking: (await repository.getAll('cooking_logs')).length,
    }).toEqual(firstCounts);
    expect((await repository.getAll('entries')).map((entry) => entry.id)).toContain(canonicalLifeLedgerId('diet', 'meal:meal-1'));
    expect((await repository.getAll('entries')).filter((entry) => entry.type === 'expense' || entry.type === 'income')).toHaveLength(2);
  });

  it('classifies CookingLog as independent data and preserves only event fields plus references', async () => {
    const repository = new MemoryLifeLedgerRepository();
    const first = await runLifeLedgerShadowMigration({ snapshot: fixture(), repository, assets: assets() });
    const [record] = await repository.getAll('cooking_logs');
    expect(first.cookingLogStrategy).toEqual({ classification: 'independent', migration: 'canonical cooking_logs store' });
    expect(record).toMatchObject({
      id: canonicalLifeLedgerId('diet', 'cooking:cook-1'), title: '實際煮湯', ingredients: ['水', '鹽'], steps: ['慢煮'],
      notes: '今天少鹽', tags: ['家常'], recipeId: canonicalLifeLedgerId('diet', 'recipe:recipe-1'),
      source: { owner: 'diet', legacyId: 'cooking:cook-1', migrationVersion: 2 },
    });
    expect(record).not.toHaveProperty('mealEntry');
    expect(record).not.toHaveProperty('recipe');
    await runLifeLedgerShadowMigration({ snapshot: fixture(), repository, assets: assets() });
    expect(await repository.getAll('cooking_logs')).toHaveLength(1);
  });

  it('keeps receipt meals as references, recipes intact, farewell unchanged, and historical rates absent', async () => {
    const repository = new MemoryLifeLedgerRepository();
    await runLifeLedgerShadowMigration({ snapshot: fixture(), repository, assets: assets() });
    const [receipt] = await repository.getAll('diet_receipts');
    expect(receipt.mealEntryIds).toEqual([canonicalLifeLedgerId('diet', 'meal:meal-1')]);
    expect(receipt).not.toHaveProperty('mealEntries');
    expect((await repository.getAll('recipes'))[0]).toMatchObject({ title: '湯', ingredients: ['水'], steps: ['煮'], isFavorite: true });
    expect((await repository.getAll('item_lifecycle_events')).map((event) => event.to)).toEqual(['aging', 'farewell']);
    const financial = (await repository.getAll('entries')).find((entry) => entry.type === 'expense');
    expect(financial?.monetary).not.toHaveProperty('exchangeRate');
    expect(financial?.monetary).not.toHaveProperty('convertedAmountMinor');
  });

  it('migrates readable Data URLs without Base64 in canonical records', async () => {
    const repository = new MemoryLifeLedgerRepository();
    const meta = await runLifeLedgerShadowMigration({ snapshot: fixture(), repository, assets: assets() });
    expect(meta.verification?.readableAssetCount).toBe(3);
    const serialized = JSON.stringify(await repository.getAll('entries'));
    expect(serialized).not.toContain('data:image');
    expect(serialized).toContain('life-ledger-sha256-');
  });

  it('marks asset failure, leaves legacy bytes untouched, and blocks verification', async () => {
    const snapshot = fixture();
    const before = { ...snapshot };
    const repository = new MemoryLifeLedgerRepository();
    const meta = await runLifeLedgerShadowMigration({ snapshot, repository, assets: assets(true) });
    expect(meta.status).toBe('verification_failed');
    expect(meta.verification?.failedAssetCount).toBe(3);
    expect(snapshot).toEqual(before);
    expect((await repository.getAll('entries')).find((entry) => entry.type === 'food')?.assetMigration?.status).toBe('failed');
    expect((await getLifeLedgerMigrationReport(repository)).failedAssetCount).toBe(3);
  });

  it('prevents verified status for unresolved records and duplicate source identities', async () => {
    const unresolvedRepository = new MemoryLifeLedgerRepository();
    const unresolved = fixture();
    const parsed = JSON.parse(unresolved.appRaw!);
    parsed.state.cookingLogs.push({ id: '', title: '', mealType: 'lunch' });
    unresolved.appRaw = JSON.stringify(parsed);
    const unresolvedMeta = await runLifeLedgerShadowMigration({ snapshot: unresolved, repository: unresolvedRepository, assets: assets() });
    expect(unresolvedMeta.status).toBe('verification_failed');
    expect(unresolvedMeta.verification?.unresolvedRecordCount).toBe(1);
    expect((await getLifeLedgerMigrationReport(unresolvedRepository)).unresolvedRecordCount).toBe(1);

    const duplicateRepository = new MemoryLifeLedgerRepository();
    await duplicateRepository.put('recipes', [{
      id: 'conflicting-record', source: { owner: 'diet', legacyId: 'recipe:recipe-1', migrationVersion: 1 }, title: 'conflict', category: 'main', ingredients: [], steps: [], isFavorite: false, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    }]);
    const duplicateMeta = await runLifeLedgerShadowMigration({ snapshot: fixture(), repository: duplicateRepository, assets: assets() });
    expect(duplicateMeta.status).toBe('verification_failed');
    expect(duplicateMeta.verification?.duplicateCount).toBe(1);
    expect((await getLifeLedgerMigrationReport(duplicateRepository)).duplicateSourceIdentityCount).toBe(1);
  });

  it('skips canonical mirrors and migrates only genuine legacy ObjectMemory records', async () => {
    const nativeId = 'item:item:ui:1700000000000:abc123';
    const repository = new MemoryLifeLedgerRepository();
    await repository.put('entries', [{
      id: nativeId, type: 'item', title: '原生相機', occurredAt: '2026-09-17', createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z',
      revision: 1, source: { owner: 'life-ledger', legacyId: '', migrationVersion: 0 }, notes: '',
      item: { category: '相機', lifecycleState: 'active', startDate: '2026-09-17', usageDays: 0 },
    }]);

    const snapshot = fixture();
    const mirror = JSON.parse(snapshot.objectsRaw!);
    mirror.state.objects.push({
      id: nativeId, name: '原生相機', category: '相機', lifecycleState: 'active', startDate: '2026-09-17',
      notes: '', usageDays: 0, usageLogs: [], lifecycleEvents: [], createdAt: 1, updatedAt: 2,
    });
    const mixed = { ...snapshot, objectsRaw: JSON.stringify(mirror) };

    const meta = await runLifeLedgerShadowMigration({ snapshot: mixed, repository, assets: assets() });

    expect(meta.status).toBe('verified');
    expect(meta.verification?.sourceCounts.objects).toBe(2);
    expect(meta.verification?.targetCounts.item).toBe(1);

    const itemIds = (await repository.getAll('entries')).filter((entry) => entry.type === 'item').map((entry) => entry.id).sort();
    expect(itemIds).toEqual([canonicalLifeLedgerId('object-memory', 'item:object-1'), nativeId].sort());

    const native = (await repository.getAll('entries')).find((entry) => entry.id === nativeId);
    expect(native?.source).toMatchObject({ owner: 'life-ledger', legacyId: '' });
    expect(native?.revision).toBe(1);

    // Lifecycle events belong only to the migrated legacy object.
    const events = await repository.getAll('item_lifecycle_events');
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.itemEntryId === canonicalLifeLedgerId('object-memory', 'item:object-1'))).toBe(true);

    const projection = await loadLifeLedgerReadModel(repository);
    expect(projection.itemEntries.map((entry) => entry.title).sort()).toEqual(['原生相機', '舊杯子']);

    // A repeated boot migration adds nothing.
    const before = (await repository.getAll('entries')).length;
    await runLifeLedgerShadowMigration({ snapshot: mixed, repository, assets: assets() });
    expect((await repository.getAll('entries')).length).toBe(before);
  });

  it('returns structural diagnostics only and installs the hook only in development', async () => {
    const repository = new MemoryLifeLedgerRepository();
    await runLifeLedgerShadowMigration({ snapshot: fixture(), repository, assets: assets() });
    const storage = { getItem: (key: string) => key === 'lunartide_data' || key === 'lunartide_object_memory' ? '{}' : null };
    let auditWriteCount = 0;
    const readOnlyProbe: Pick<import('./repository').LifeLedgerRepository, 'getAll'> & { put: import('./repository').LifeLedgerRepository['put'] } = {
      getAll: (store) => repository.getAll(store),
      put: async () => { auditWriteCount += 1; },
    };
    const before = JSON.stringify({
      entries: await repository.getAll('entries'), recipes: await repository.getAll('recipes'), cooking: await repository.getAll('cooking_logs'),
      events: await repository.getAll('item_lifecycle_events'), receipts: await repository.getAll('diet_receipts'), meta: await repository.getAll('migration_meta'),
    });
    const report = await getLifeLedgerMigrationReport(readOnlyProbe, storage);
    const secondReport = await getLifeLedgerMigrationReport(readOnlyProbe, storage);
    const after = JSON.stringify({
      entries: await repository.getAll('entries'), recipes: await repository.getAll('recipes'), cooking: await repository.getAll('cooking_logs'),
      events: await repository.getAll('item_lifecycle_events'), receipts: await repository.getAll('diet_receipts'), meta: await repository.getAll('migration_meta'),
    });
    expect(report).toEqual(secondReport);
    expect(auditWriteCount).toBe(0);
    expect(after).toBe(before);
    expect(report).toMatchObject({
      databaseVersion: 2, schemaVersion: 2, migrationVersion: 2, status: 'verified',
      cookingLog: { sourceCount: 1, targetCount: 1, classification: 'independent' },
      legacySourcesStillPresent: true, duplicateSourceIdentityCount: 0, failedAssetCount: 0, unresolvedRecordCount: 0,
    });
    expect(Object.keys(report.sourceChecksums).sort()).toEqual(['lunartide_data', 'lunartide_object_memory']);
    expect(Object.keys(report.targetChecksums).sort()).toEqual(['cooking_logs', 'diet_receipts', 'entries', 'item_lifecycle_events', 'recipes']);
    expect(Object.values(report.sourceChecksums).every((fingerprint) => /^[a-f0-9]{64}$/.test(fingerprint))).toBe(true);
    expect(Object.values(report.targetChecksums).every((fingerprint) => /^[a-f0-9]{64}$/.test(fingerprint))).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('實際煮湯');
    expect(serialized).not.toContain('今天少鹽');
    delete window.__LUNARTIDE_LIFE_LEDGER_AUDIT__;
    installLifeLedgerDevAudit(false);
    expect(window.__LUNARTIDE_LIFE_LEDGER_AUDIT__).toBeUndefined();
  });
});
