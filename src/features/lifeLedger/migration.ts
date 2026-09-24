import type { MoneyTransaction, ObjectMemory } from '@/types';
import { getAsset, saveAssetWithId } from '@/store/assets';
import {
  LIFE_LEDGER_MIGRATION_VERSION,
  LIFE_LEDGER_DB_VERSION,
  COOKING_LOG_CLASSIFICATION,
  canonicalLifeLedgerId,
  type LifeLedgerDietReceipt,
  type LifeLedgerCookingLog,
  type LifeLedgerEntry,
  type LifeLedgerItemLifecycleEvent,
  type LifeLedgerMigrationMeta,
  type LifeLedgerRecipe,
  type LifeLedgerVerificationReport,
} from './domain';
import { lifeLedgerRepository, type LifeLedgerRepository } from './repository';

export const LEGACY_APP_STORAGE_KEY = 'lunartide_data';
export const LEGACY_OBJECT_STORAGE_KEY = 'lunartide_object_memory';

type LegacyMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type LegacyMealEntry = {
  id: string; createdAt: number; updatedAt: number; mealType: LegacyMealType; title: string;
  status?: 'eaten' | 'skipped' | 'missing'; photo?: string; imageAssetId?: string;
  calories?: number; protein?: number; carbs?: number; fat?: number; water?: number;
  mood?: string; notes?: string; tags?: string[];
};
type LegacyRecipe = {
  id: string; title: string; cover?: string;
  category: 'breakfast' | 'main' | 'dessert' | 'drink' | 'quick' | 'high-protein';
  ingredients: string[]; steps: string[]; tags?: string[]; notes?: string;
  isFavorite: boolean; createdAt: number; updatedAt: number;
};
type LegacyDietReceipt = {
  id: string; date: string; mealEntries: LegacyMealEntry[];
  totals: { calories: number; protein: number; carbs: number; fat: number; water: number };
  viewed: boolean; memoryEntryId?: string; savedToSecondBrainAt?: number;
  createdAt: number; updatedAt: number;
};
type LegacyCookingLog = {
  id: string; createdAt: number; updatedAt: number; mealType: LegacyMealType; title: string;
  photo?: string; ingredients?: string[]; steps?: string[]; notes?: string; tags?: string[];
  saveAsRecipe?: boolean; recipeId?: string;
};

type LegacyAppState = {
  mealEntries?: LegacyMealEntry[];
  recipes?: LegacyRecipe[];
  dietReceipts?: LegacyDietReceipt[];
  moneyTransactions?: MoneyTransaction[];
  cookingLogs?: LegacyCookingLog[];
  ledgerEntries?: unknown[];
};

type LegacyObjectState = { objects?: ObjectMemory[] };

export interface LifeLedgerLegacySnapshot {
  appRaw: string | null;
  objectsRaw: string | null;
}

export interface LifeLedgerAssetGateway {
  saveWithId(id: string, blob: Blob, fileType: string): Promise<void>;
  get(id: string): Promise<Blob | null>;
}

const defaultAssetGateway: LifeLedgerAssetGateway = { saveWithId: saveAssetWithId, get: getAsset };

function persistedState<T>(raw: string | null): T {
  if (!raw) return {} as T;
  const parsed = JSON.parse(raw) as { state?: T } & T;
  return (parsed.state ?? parsed) as T;
}

function persistedVersion(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as { version?: unknown };
  return typeof parsed.version === 'number' ? parsed.version : undefined;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checksum(value: unknown): Promise<string> {
  return sha256(stableStringify(value));
}

function asIso(value: number | string | undefined): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

function decodeDataUrl(value: string): { blob: Blob; fileType: string; bytes: ArrayBuffer } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) throw new Error('invalid_data_url');
  const fileType = match[1] || 'application/octet-stream';
  const binary = match[2]
    ? atob(match[3])
    : decodeURIComponent(match[3]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { blob: new Blob([bytes], { type: fileType }), fileType, bytes: bytes.buffer };
}

async function migrateAsset(reference: string | undefined, gateway: LifeLedgerAssetGateway, isExistingAssetId = false) {
  if (!reference) return { assetMigration: { status: 'not_applicable' as const } };
  if (!reference.startsWith('data:')) {
    if (!isExistingAssetId) return { assetMigration: { status: 'not_applicable' as const } };
    const existing = await gateway.get(reference).catch(() => null);
    return existing
      ? { assetId: reference, assetMigration: { status: 'existing_verified' as const, assetId: reference } }
      : { assetMigration: { status: 'failed' as const, errorCode: 'existing_asset_unreadable' } };
  }
  try {
    const decoded = decodeDataUrl(reference);
    const assetId = `life-ledger-sha256-${await sha256(decoded.bytes)}`;
    await gateway.saveWithId(assetId, decoded.blob, decoded.fileType);
    const readable = await gateway.get(assetId);
    if (!readable) throw new Error('asset_verify_failed');
    return { assetId, assetMigration: { status: 'migrated' as const, assetId } };
  } catch (error) {
    return { assetMigration: { status: 'failed' as const, errorCode: error instanceof Error ? error.message : 'asset_migration_failed' } };
  }
}

function source(owner: 'diet' | 'object-memory' | 'money-transaction', legacyId: string, migrationVersion = 1) {
  return { owner, legacyId, migrationVersion } as const;
}

async function mealEntry(meal: LegacyMealEntry, gateway: LifeLedgerAssetGateway): Promise<LifeLedgerEntry> {
  const asset = await migrateAsset(meal.imageAssetId ?? meal.photo, gateway, Boolean(meal.imageAssetId));
  return {
    id: canonicalLifeLedgerId('diet', `meal:${meal.id}`), type: 'food', title: meal.title,
    occurredAt: asIso(meal.createdAt), createdAt: asIso(meal.createdAt), updatedAt: asIso(meal.updatedAt),
    source: source('diet', `meal:${meal.id}`), notes: meal.notes, tags: meal.tags,
    ...asset,
    food: { mealType: meal.mealType, status: meal.status ?? 'eaten', calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, water: meal.water, mood: meal.mood },
  };
}

async function itemEntry(item: ObjectMemory, gateway: LifeLedgerAssetGateway): Promise<LifeLedgerEntry> {
  const asset = await migrateAsset(item.image, gateway);
  return {
    id: canonicalLifeLedgerId('object-memory', `item:${item.id}`), type: 'item', title: item.name,
    occurredAt: asIso(item.startDate), createdAt: asIso(item.createdAt), updatedAt: asIso(item.updatedAt),
    source: source('object-memory', `item:${item.id}`), notes: item.notes, ...asset,
    item: { category: item.category, lifecycleState: item.lifecycleState, startDate: item.startDate, endDate: item.endDate, usageDays: item.usageDays },
  };
}

function financialEntry(transaction: MoneyTransaction): LifeLedgerEntry {
  return {
    id: canonicalLifeLedgerId('money-transaction', transaction.id), type: transaction.type,
    title: transaction.title ?? transaction.note ?? transaction.categoryId,
    occurredAt: asIso(transaction.occurredAt), createdAt: asIso(transaction.createdAt), updatedAt: transaction.updatedAt ? asIso(transaction.updatedAt) : undefined,
    source: source('money-transaction', transaction.id), notes: transaction.note,
    monetary: { amountMinor: transaction.amountMinor, currency: transaction.currency, accountId: transaction.accountId, categoryId: transaction.categoryId, origin: transaction.source },
  };
}

async function recipeEntry(recipe: LegacyRecipe, gateway: LifeLedgerAssetGateway): Promise<LifeLedgerRecipe> {
  const asset = await migrateAsset(recipe.cover, gateway);
  return {
    id: canonicalLifeLedgerId('diet', `recipe:${recipe.id}`), source: source('diet', `recipe:${recipe.id}`), title: recipe.title,
    category: recipe.category, ingredients: [...recipe.ingredients], steps: [...recipe.steps], tags: recipe.tags, notes: recipe.notes,
    isFavorite: recipe.isFavorite, ...asset, createdAt: asIso(recipe.createdAt), updatedAt: asIso(recipe.updatedAt),
  };
}

function lifecycleEntries(item: ObjectMemory): LifeLedgerItemLifecycleEvent[] {
  return (item.lifecycleEvents ?? []).map((event, sequence) => ({
    id: canonicalLifeLedgerId('object-memory', `lifecycle:${event.id}`),
    itemEntryId: canonicalLifeLedgerId('object-memory', `item:${item.id}`), sequence,
    source: source('object-memory', `lifecycle:${event.id}`), from: event.from, to: event.to, action: event.action,
    reason: event.reason, emotion: event.emotion, context: event.context, note: event.note, createdAt: asIso(event.createdAt),
  }));
}

function receiptEntry(receipt: LegacyDietReceipt): LifeLedgerDietReceipt {
  return {
    id: canonicalLifeLedgerId('diet', `receipt:${receipt.id}`), source: source('diet', `receipt:${receipt.id}`), date: receipt.date,
    mealEntryIds: receipt.mealEntries.map((meal) => canonicalLifeLedgerId('diet', `meal:${meal.id}`)), totals: { ...receipt.totals },
    viewed: receipt.viewed, memoryEntryId: receipt.memoryEntryId,
    savedToSecondBrainAt: receipt.savedToSecondBrainAt ? asIso(receipt.savedToSecondBrainAt) : undefined,
    createdAt: asIso(receipt.createdAt), updatedAt: asIso(receipt.updatedAt),
  };
}

async function cookingLogEntry(log: LegacyCookingLog, gateway: LifeLedgerAssetGateway): Promise<LifeLedgerCookingLog> {
  const asset = await migrateAsset(log.photo, gateway);
  return {
    id: canonicalLifeLedgerId('diet', `cooking:${log.id}`),
    source: source('diet', `cooking:${log.id}`, LIFE_LEDGER_MIGRATION_VERSION),
    title: log.title,
    cookedAt: asIso(log.createdAt),
    updatedAt: asIso(log.updatedAt),
    mealType: log.mealType,
    ingredients: log.ingredients ? [...log.ingredients] : undefined,
    steps: log.steps ? [...log.steps] : undefined,
    notes: log.notes,
    tags: log.tags ? [...log.tags] : undefined,
    saveAsRecipe: Boolean(log.saveAsRecipe),
    recipeId: log.recipeId ? canonicalLifeLedgerId('diet', `recipe:${log.recipeId}`) : undefined,
    ...asset,
  };
}

function sumNutrition(meals: LegacyMealEntry[]) {
  return meals.reduce((totals, meal) => ({
    calories: totals.calories + (meal.calories ?? 0), protein: totals.protein + (meal.protein ?? 0),
    carbs: totals.carbs + (meal.carbs ?? 0), fat: totals.fat + (meal.fat ?? 0), water: totals.water + (meal.water ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
}

function sumMoney(transactions: MoneyTransaction[]) {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    const key = `${transaction.type}:${transaction.currency}`;
    totals[key] = (totals[key] ?? 0) + transaction.amountMinor;
    return totals;
  }, {});
}

function isMigratableCookingLog(value: unknown): value is LegacyCookingLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as Partial<LegacyCookingLog>;
  return typeof log.id === 'string' && log.id.length > 0
    && typeof log.title === 'string' && log.title.length > 0
    && (log.mealType === 'breakfast' || log.mealType === 'lunch' || log.mealType === 'dinner' || log.mealType === 'snack')
    && typeof log.createdAt === 'number' && typeof log.updatedAt === 'number';
}

export async function runLifeLedgerShadowMigration(options: {
  snapshot: LifeLedgerLegacySnapshot;
  repository?: LifeLedgerRepository;
  assets?: LifeLedgerAssetGateway;
  now?: () => Date;
}): Promise<LifeLedgerMigrationMeta> {
  const repository = options.repository ?? lifeLedgerRepository;
  const assets = options.assets ?? defaultAssetGateway;
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const app = persistedState<LegacyAppState>(options.snapshot.appRaw);
  const objectState = persistedState<LegacyObjectState>(options.snapshot.objectsRaw);
  const meals = app.mealEntries ?? [];
  const recipes = app.recipes ?? [];
  const receipts = app.dietReceipts ?? [];
  const transactions = app.moneyTransactions ?? [];
  const cookingLogs = app.cookingLogs ?? [];
  const migratableCookingLogs = cookingLogs.filter(isMigratableCookingLog);
  const unresolvedCookingLogCount = cookingLogs.length - migratableCookingLogs.length;
  const objects = objectState.objects ?? [];

  /* Skip mirrors of canonical items. `canonicalEntryToObjectMemory` copies the
     canonical entry id into the ObjectMemory mirror, so a mirror object whose id
     already exists as a canonical item id was written by `resyncItemsStoreAfterWrite`
     and is not a legacy source record. Legacy ObjectMemory ids come from `genId()`
     (UUID or `obj-<ts>-<rand>`) and can never collide with a canonical id, which is
     `item:item:ui:<ts>:<rand>` for native items or
     `life-ledger:v1:object-memory:item:<legacyId>` for migrated ones. */
  const existingItemIds = new Set(
    (await repository.getAll('entries'))
      .filter((entry) => entry.type === 'item')
      .map((entry) => entry.id),
  );
  const legacyObjects = objects.filter((item) => !existingItemIds.has(item.id));

  const sourceMeta = [
    { key: LEGACY_APP_STORAGE_KEY, schemaVersion: persistedVersion(options.snapshot.appRaw), recordCount: meals.length + recipes.length + receipts.length + transactions.length + cookingLogs.length, checksum: await checksum({ meals, recipes, receipts, transactions, cookingLogs }) },
    { key: LEGACY_OBJECT_STORAGE_KEY, schemaVersion: persistedVersion(options.snapshot.objectsRaw), recordCount: objects.length, checksum: await checksum(objects) },
  ];
  await repository.put('migration_meta', [{
    migrationVersion: LIFE_LEDGER_MIGRATION_VERSION, schemaVersion: LIFE_LEDGER_DB_VERSION, startedAt, status: 'migrating', source: sourceMeta, target: [],
    failureSummary: [], cookingLogStrategy: { classification: COOKING_LOG_CLASSIFICATION, migration: 'canonical cooking_logs store' },
  }]);

  const foodEntries = await Promise.all(meals.map((meal) => mealEntry(meal, assets)));
  const itemEntries = await Promise.all(legacyObjects.map((item) => itemEntry(item, assets)));
  const financialEntries = transactions.map(financialEntry);
  const recipeRecords = await Promise.all(recipes.map((recipe) => recipeEntry(recipe, assets)));
  const lifecycleRecords = legacyObjects.flatMap(lifecycleEntries);
  const receiptRecords = receipts.map(receiptEntry);
  const cookingRecords = await Promise.all(migratableCookingLogs.map((log) => cookingLogEntry(log, assets)));
  await repository.put('entries', [...foodEntries, ...itemEntries, ...financialEntries]);
  await repository.put('recipes', recipeRecords);
  await repository.put('item_lifecycle_events', lifecycleRecords);
  await repository.put('diet_receipts', receiptRecords);
  await repository.put('cooking_logs', cookingRecords);

  const allEntries = await repository.getAll('entries');
  const allRecipes = await repository.getAll('recipes');
  const allLifecycle = await repository.getAll('item_lifecycle_events');
  const allReceipts = await repository.getAll('diet_receipts');
  const allCooking = await repository.getAll('cooking_logs');
  const targetMeta = await Promise.all([
    ['entries', allEntries], ['recipes', allRecipes], ['item_lifecycle_events', allLifecycle], ['diet_receipts', allReceipts], ['cooking_logs', allCooking],
  ].map(async ([key, records]) => ({ key: key as string, recordCount: (records as unknown[]).length, checksum: await checksum(records) })));

  const identities = [...allEntries, ...allRecipes, ...allLifecycle, ...allReceipts, ...allCooking].map((record) => `${record.source.owner}:${record.source.legacyId}`);
  const expectedLifecycleIds = new Set(legacyObjects.flatMap(lifecycleEntries).map((event) => event.id));
  const targetLifecycle = allLifecycle.filter((event) => expectedLifecycleIds.has(event.id))
    .sort((a, b) => a.itemEntryId.localeCompare(b.itemEntryId) || a.sequence - b.sequence);
  const expectedLifecycle = legacyObjects.flatMap(lifecycleEntries).sort((a, b) => a.itemEntryId.localeCompare(b.itemEntryId) || a.sequence - b.sequence);
  const migratedAssets = [...foodEntries, ...itemEntries, ...recipeRecords, ...cookingRecords].map((record) => record.assetMigration);
  const errors: string[] = [];
  if (foodEntries.length !== meals.length) errors.push('food_count_mismatch');
  if (itemEntries.length !== legacyObjects.length) errors.push('item_count_mismatch');
  if (financialEntries.length !== transactions.length) errors.push('financial_count_mismatch');
  if (cookingRecords.length !== cookingLogs.length) errors.push('cooking_log_count_mismatch');
  if (unresolvedCookingLogCount > 0) errors.push('unresolved_cooking_log');
  if (stableStringify(targetLifecycle) !== stableStringify(expectedLifecycle)) errors.push('lifecycle_order_mismatch');
  if (new Set(identities).size !== identities.length) errors.push('duplicate_source_identity');
  if (migratedAssets.some((asset) => asset?.status === 'failed')) errors.push('asset_migration_failed');

  const verification: LifeLedgerVerificationReport = {
    sourceCounts: { meals: meals.length, objects: objects.length, moneyTransactions: transactions.length, recipes: recipes.length, dietReceipts: receipts.length, cookingLogs: cookingLogs.length, ledgerEntriesIgnored: app.ledgerEntries?.length ?? 0 },
    targetCounts: { food: foodEntries.length, item: itemEntries.length, financial: financialEntries.length, recipes: recipeRecords.length, dietReceipts: receiptRecords.length, lifecycleEvents: lifecycleRecords.length, cookingLogs: cookingRecords.length },
    nutritionTotals: sumNutrition(meals), monetaryTotals: sumMoney(transactions),
    lifecycleOrderPreserved: !errors.includes('lifecycle_order_mismatch'),
    readableAssetCount: migratedAssets.filter((asset) => asset?.status === 'migrated' || asset?.status === 'existing_verified').length,
    failedAssetCount: migratedAssets.filter((asset) => asset?.status === 'failed').length,
    duplicateCount: identities.length - new Set(identities).size,
    legacyBytesUnchanged: true,
    missingRatesRemainUndefined: financialEntries.every((entry) => entry.monetary?.exchangeRate === undefined && entry.monetary?.convertedAmountMinor === undefined),
    unresolvedRecordCount: unresolvedCookingLogCount,
    errors,
  };
  const meta: LifeLedgerMigrationMeta = {
    migrationVersion: LIFE_LEDGER_MIGRATION_VERSION, schemaVersion: LIFE_LEDGER_DB_VERSION, startedAt, completedAt: now().toISOString(),
    verifiedAt: errors.length === 0 ? now().toISOString() : undefined,
    status: errors.length === 0 ? 'verified' : 'verification_failed', source: sourceMeta, target: targetMeta, verification,
    failureSummary: [...errors], cookingLogStrategy: { classification: COOKING_LOG_CLASSIFICATION, migration: 'canonical cooking_logs store' },
  };
  await repository.put('migration_meta', [meta]);
  return meta;
}

export function captureLifeLedgerLegacySnapshot(storage: Pick<Storage, 'getItem'> = localStorage): LifeLedgerLegacySnapshot {
  return { appRaw: storage.getItem(LEGACY_APP_STORAGE_KEY), objectsRaw: storage.getItem(LEGACY_OBJECT_STORAGE_KEY) };
}

export async function migrateLifeLedgerFromLocalStorage(): Promise<LifeLedgerMigrationMeta> {
  const snapshot = captureLifeLedgerLegacySnapshot();
  const meta = await runLifeLedgerShadowMigration({ snapshot });
  const after = captureLifeLedgerLegacySnapshot();
  const unchanged = snapshot.appRaw === after.appRaw && snapshot.objectsRaw === after.objectsRaw;
  if (!unchanged) throw new Error('Life Ledger shadow migration modified a legacy source');
  if (meta.verification) meta.verification.legacyBytesUnchanged = unchanged;
  await lifeLedgerRepository.put('migration_meta', [meta]);
  return meta;
}
