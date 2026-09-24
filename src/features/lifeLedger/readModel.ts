import type {
  LifeLedgerCookingLog,
  LifeLedgerDietReceipt,
  LifeLedgerEntry,
  LifeLedgerItemLifecycleEvent,
  LifeLedgerMigrationMeta,
  LifeLedgerRecipe,
} from './domain';
import { lifeLedgerRepository, type LifeLedgerRepository } from './repository';

export interface LifeLedgerReadModel {
  entries: LifeLedgerEntry[];
  foodEntries: LifeLedgerEntry[];
  itemEntries: LifeLedgerEntry[];
  financeEntries: LifeLedgerEntry[];
  recipes: LifeLedgerRecipe[];
  cookingLogs: LifeLedgerCookingLog[];
  receipts: LifeLedgerDietReceipt[];
  lifecycleEvents: LifeLedgerItemLifecycleEvent[];
  migrationHealth?: LifeLedgerMigrationMeta;
  nutritionTotals: { calories: number; protein: number; carbs: number; fat: number; water: number };
}

export async function loadLifeLedgerReadModel(repository: LifeLedgerRepository = lifeLedgerRepository): Promise<LifeLedgerReadModel> {
  const [entries, recipes, cookingLogs, receipts, migrationHealth, lifecycleEvents] = await Promise.all([
    repository.getAllEntries(),
    repository.getRecipes(),
    repository.getCookingLogs(),
    repository.getDietReceipts(),
    repository.getMigrationHealth(),
    repository.getAll('item_lifecycle_events'),
  ]);
  const foodEntries = entries.filter((entry) => entry.type === 'food');
  const itemEntries = entries.filter((entry) => entry.type === 'item');
  const financeEntries = entries.filter((entry) => entry.type === 'expense' || entry.type === 'income');
  const nutritionTotals = foodEntries.reduce((totals, entry) => ({
    calories: totals.calories + (entry.food?.calories ?? 0),
    protein: totals.protein + (entry.food?.protein ?? 0),
    carbs: totals.carbs + (entry.food?.carbs ?? 0),
    fat: totals.fat + (entry.food?.fat ?? 0),
    water: totals.water + (entry.food?.water ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
  return {
    entries, foodEntries, itemEntries, financeEntries, recipes, cookingLogs, receipts,
    lifecycleEvents: lifecycleEvents.sort((a, b) => a.itemEntryId.localeCompare(b.itemEntryId) || a.sequence - b.sequence || a.id.localeCompare(b.id)),
    migrationHealth, nutritionTotals,
  };
}

export function formatMinorAmount(amountMinor: number, currency: string, locale = 'zh-TW'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / (10 ** digits));
}
