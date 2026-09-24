/**
 * Life Ledger Compatibility Adapters — Phase 1D-A
 *
 * Pure functions that translate legacy form/domain input
 * into canonical Life Ledger commands.
 *
 * Adapters do NOT write. They only translate and validate.
 * Production wiring is Phase 1D-B.
 */

import type {
  CreateFoodEntry,
  CreateItemEntry,
  CreateFinancialEntry,
  CreateCookingLog,
  CreateRecipe,
  LifeLedgerCommand,
} from './mutations';

/* ══════════════════════════════════════
   Legacy Input Types
   ══════════════════════════════════════ */

export interface LegacyMealInput {
  title: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  status?: 'eaten' | 'skipped' | 'missing';
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  water?: number;
  mood?: string;
  notes?: string;
  tags?: string[];
  imageAssetId?: string;
  occurredAt?: string;
}

export interface LegacyObjectInput {
  name: string;
  category: string;
  lifecycleState: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
  startDate: string;
  endDate?: string;
  notes?: string;
  image?: string;
}

export interface LegacyMoneyTransactionInput {
  type: 'income' | 'expense';
  amountMinor: number;
  currency: string;
  accountId: string;
  categoryId: string;
  source: 'manual' | 'chat' | 'import';
  title?: string;
  note?: string;
  occurredAt: string;
}

export interface LegacyCookingLogInput {
  title: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ingredients?: string[];
  steps?: string[];
  notes?: string;
  tags?: string[];
  photo?: string;
  saveAsRecipe?: boolean;
  recipeId?: string;
  cookedAt?: string;
}

export interface LegacyRecipeInput {
  title: string;
  category: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  notes?: string;
  isFavorite: boolean;
  cover?: string;
}

/* ══════════════════════════════════════
   Adapter Functions
   ══════════════════════════════════════ */

let adapterCommandCounter = 0;

function nextCommandId(prefix: string): string {
  adapterCommandCounter += 1;
  return `${prefix}:adapter:${Date.now()}:${adapterCommandCounter}`;
}

/**
 * Translate legacy meal input → CreateFoodEntry command.
 * Does NOT write. Returns command only.
 */
export function adaptMealToFoodCommand(input: LegacyMealInput): CreateFoodEntry {
  return {
    type: 'CreateFoodEntry',
    commandId: nextCommandId('food'),
    timestamp: new Date().toISOString(),
    payload: {
      title: input.title,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      notes: input.notes,
      tags: input.tags,
      assetId: input.imageAssetId,
      food: {
        mealType: input.mealType,
        status: input.status ?? 'eaten',
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        water: input.water,
        mood: input.mood,
      },
    },
  };
}

/**
 * Translate legacy object input → CreateItemEntry command.
 * Does NOT write. Returns command only.
 */
export function adaptObjectToItemCommand(input: LegacyObjectInput): CreateItemEntry {
  const now = new Date();
  const start = new Date(input.startDate);
  const end = input.endDate ? new Date(input.endDate) : now;
  const usageDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));

  return {
    type: 'CreateItemEntry',
    commandId: nextCommandId('item'),
    timestamp: now.toISOString(),
    payload: {
      title: input.name,
      occurredAt: now.toISOString(),
      notes: input.notes,
      assetId: input.image,
      item: {
        category: input.category,
        lifecycleState: input.lifecycleState,
        startDate: input.startDate,
        endDate: input.endDate,
        usageDays,
      },
    },
  };
}

/**
 * Translate legacy money transaction input → CreateFinancialEntry command.
 * Does NOT write. Returns command only.
 */
export function adaptMoneyToFinancialCommand(input: LegacyMoneyTransactionInput): CreateFinancialEntry {
  return {
    type: 'CreateFinancialEntry',
    commandId: nextCommandId('fin'),
    timestamp: new Date().toISOString(),
    payload: {
      title: input.title ?? (input.type === 'income' ? '收入' : '支出'),
      occurredAt: input.occurredAt,
      notes: input.note,
      monetary: {
        amountMinor: input.amountMinor,
        currency: input.currency,
        accountId: input.accountId,
        categoryId: input.categoryId,
        origin: input.source,
      },
    },
  };
}

/**
 * Translate legacy cooking log input → CreateCookingLog command.
 * Does NOT write. Returns command only.
 */
export function adaptCookingLogCommand(input: LegacyCookingLogInput): CreateCookingLog {
  return {
    type: 'CreateCookingLog',
    commandId: nextCommandId('cook'),
    timestamp: new Date().toISOString(),
    payload: {
      title: input.title,
      cookedAt: input.cookedAt ?? new Date().toISOString(),
      mealType: input.mealType,
      ingredients: input.ingredients,
      steps: input.steps,
      notes: input.notes,
      tags: input.tags,
      saveAsRecipe: input.saveAsRecipe ?? false,
      recipeId: input.recipeId,
      assetId: input.photo,
    },
  };
}

/**
 * Translate legacy recipe input → CreateRecipe command.
 * Does NOT write. Returns command only.
 */
export function adaptRecipeCommand(input: LegacyRecipeInput): CreateRecipe {
  return {
    type: 'CreateRecipe',
    commandId: nextCommandId('recipe'),
    timestamp: new Date().toISOString(),
    payload: {
      title: input.title,
      category: input.category,
      ingredients: input.ingredients,
      steps: input.steps,
      tags: input.tags,
      notes: input.notes,
      isFavorite: input.isFavorite,
      assetId: input.cover,
    },
  };
}

/**
 * Check if a command was produced by an adapter.
 * Used to verify no direct adapter→write path exists.
 */
export function isAdapterCommand(cmd: LifeLedgerCommand): boolean {
  return cmd.commandId.includes(':adapter:');
}
