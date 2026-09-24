/**
 * Life Ledger Mutation Service — Phase 1D-A Foundation
 *
 * Canonical mutation owner for all Life Ledger entities.
 * Provides typed commands, validation, optimistic concurrency,
 * atomic transactions, idempotency, and structured results.
 *
 * This module does NOT wire into production UI (Phase 1D-B).
 */

import {
  LIFE_LEDGER_NATIVE_SOURCE_OWNER,
  type LifeLedgerEntry,
  type LifeLedgerRecipe,
  type LifeLedgerCookingLog,
  type LifeLedgerDietReceipt,
  type LifeLedgerItemLifecycleEvent,
  type LifeLedgerSource,
} from './domain';
import type { LifeLedgerRepository, LifeLedgerStoreName, LifeLedgerTransactionContext } from './repository';

/* ══════════════════════════════════════
   Mutation Result
   ══════════════════════════════════════ */

export type MutationStatus = 'committed' | 'rejected' | 'conflict';

export interface MutationResult {
  status: MutationStatus;
  entityId: string;
  revision: number;
  committedAt: string;
  affectedStores: string[];
  errorCode?: string;
}

/* ══════════════════════════════════════
   Command Envelope
   ══════════════════════════════════════ */

interface CommandBase {
  commandId: string;
  timestamp?: string;
}

/* ══════════════════════════════════════
   Food Commands
   ══════════════════════════════════════ */

export interface CreateFoodEntry extends CommandBase {
  type: 'CreateFoodEntry';
  payload: {
    title: string;
    occurredAt: string;
    notes?: string;
    tags?: string[];
    assetId?: string;
    food: {
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      status: 'eaten' | 'skipped' | 'missing';
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      water?: number;
      mood?: string;
    };
  };
}

export interface UpdateFoodEntry extends CommandBase {
  type: 'UpdateFoodEntry';
  entityId: string;
  expectedRevision: number;
  payload: {
    title?: string;
    occurredAt?: string;
    notes?: string;
    tags?: string[];
    assetId?: string;
    food?: {
      mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      status?: 'eaten' | 'skipped' | 'missing';
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      water?: number;
      mood?: string;
    };
  };
}

export interface DeleteFoodEntry extends CommandBase {
  type: 'DeleteFoodEntry';
  entityId: string;
  expectedRevision: number;
}

/* ══════════════════════════════════════
   CookingLog Commands
   ══════════════════════════════════════ */

export interface CreateCookingLog extends CommandBase {
  type: 'CreateCookingLog';
  payload: {
    title: string;
    cookedAt: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    ingredients?: string[];
    steps?: string[];
    notes?: string;
    tags?: string[];
    saveAsRecipe: boolean;
    recipeId?: string;
    assetId?: string;
  };
}

export interface UpdateCookingLog extends CommandBase {
  type: 'UpdateCookingLog';
  entityId: string;
  expectedRevision: number;
  payload: {
    title?: string;
    cookedAt?: string;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    ingredients?: string[];
    steps?: string[];
    notes?: string;
    tags?: string[];
    saveAsRecipe?: boolean;
    recipeId?: string;
    assetId?: string;
  };
}

export interface DeleteCookingLog extends CommandBase {
  type: 'DeleteCookingLog';
  entityId: string;
  expectedRevision: number;
}

/* ══════════════════════════════════════
   Item Commands
   ══════════════════════════════════════ */

export interface CreateItemEntry extends CommandBase {
  type: 'CreateItemEntry';
  payload: {
    title: string;
    occurredAt: string;
    notes?: string;
    tags?: string[];
    assetId?: string;
    item: {
      category: string;
      lifecycleState: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
      startDate: string;
      endDate?: string;
      usageDays: number;
    };
  };
}

export interface UpdateItemEntry extends CommandBase {
  type: 'UpdateItemEntry';
  entityId: string;
  expectedRevision: number;
  payload: {
    title?: string;
    occurredAt?: string;
    notes?: string;
    tags?: string[];
    assetId?: string;
    item?: {
      category?: string;
      lifecycleState?: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
      startDate?: string;
      endDate?: string;
      usageDays?: number;
    };
  };
}

export interface DeleteItemEntry extends CommandBase {
  type: 'DeleteItemEntry';
  entityId: string;
  expectedRevision: number;
}

export interface AppendItemLifecycleEvent extends CommandBase {
  type: 'AppendItemLifecycleEvent';
  itemEntryId: string;
  expectedItemRevision: number;
  payload: {
    from?: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
    to: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
    action: 'created' | 'transitioned' | 'edited';
    reason: string;
    emotion: string;
    context?: string;
    note?: string;
  };
}

/* ══════════════════════════════════════
   Financial Commands
   ══════════════════════════════════════ */

export interface CreateFinancialEntry extends CommandBase {
  type: 'CreateFinancialEntry';
  payload: {
    title: string;
    occurredAt: string;
    notes?: string;
    tags?: string[];
    monetary: {
      amountMinor: number;
      currency: string;
      accountId: string;
      categoryId: string;
      origin: 'manual' | 'chat' | 'import';
    };
  };
}

export interface UpdateFinancialEntry extends CommandBase {
  type: 'UpdateFinancialEntry';
  entityId: string;
  expectedRevision: number;
  payload: {
    title?: string;
    occurredAt?: string;
    notes?: string;
    tags?: string[];
    monetary?: {
      amountMinor?: number;
      currency?: string;
      accountId?: string;
      categoryId?: string;
    };
  };
}

export interface DeleteFinancialEntry extends CommandBase {
  type: 'DeleteFinancialEntry';
  entityId: string;
  expectedRevision: number;
}

/* ══════════════════════════════════════
   Recipe Commands
   ══════════════════════════════════════ */

export interface CreateRecipe extends CommandBase {
  type: 'CreateRecipe';
  payload: {
    title: string;
    category: string;
    ingredients: string[];
    steps: string[];
    tags?: string[];
    notes?: string;
    isFavorite: boolean;
    assetId?: string;
  };
}

export interface UpdateRecipe extends CommandBase {
  type: 'UpdateRecipe';
  entityId: string;
  expectedRevision: number;
  payload: {
    title?: string;
    category?: string;
    ingredients?: string[];
    steps?: string[];
    tags?: string[];
    notes?: string;
    isFavorite?: boolean;
    assetId?: string;
  };
}

export interface DeleteRecipe extends CommandBase {
  type: 'DeleteRecipe';
  entityId: string;
  expectedRevision: number;
}

/* ══════════════════════════════════════
   DietReceipt Commands
   ══════════════════════════════════════ */

export interface CreateDietReceipt extends CommandBase {
  type: 'CreateDietReceipt';
  payload: {
    date: string;
    mealEntryIds: string[];
    totals: { calories: number; protein: number; carbs: number; fat: number; water: number };
    viewed: boolean;
  };
}

export interface DeleteDietReceipt extends CommandBase {
  type: 'DeleteDietReceipt';
  entityId: string;
  expectedRevision: number;
}

/* ══════════════════════════════════════
   Union Command Type
   ══════════════════════════════════════ */

export type LifeLedgerCommand =
  | CreateFoodEntry | UpdateFoodEntry | DeleteFoodEntry
  | CreateCookingLog | UpdateCookingLog | DeleteCookingLog
  | CreateItemEntry | UpdateItemEntry | DeleteItemEntry | AppendItemLifecycleEvent
  | CreateFinancialEntry | UpdateFinancialEntry | DeleteFinancialEntry
  | CreateRecipe | UpdateRecipe | DeleteRecipe
  | CreateDietReceipt | DeleteDietReceipt;

/* ══════════════════════════════════════
   Validation
   ══════════════════════════════════════ */

function reject(message: string): MutationResult {
  return { status: 'rejected', entityId: '', revision: 0, committedAt: '', affectedStores: [], errorCode: message };
}

function conflict(entityId: string, currentRevision: number): MutationResult {
  return { status: 'conflict', entityId, revision: currentRevision, committedAt: '', affectedStores: [], errorCode: 'REVISION_CONFLICT' };
}

function validateCreateFood(cmd: CreateFoodEntry): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.title?.trim()) return 'MISSING_TITLE';
  if (!cmd.payload.occurredAt) return 'MISSING_OCCURRED_AT';
  if (!cmd.payload.food) return 'MISSING_FOOD';
  if (!cmd.payload.food.mealType) return 'MISSING_MEAL_TYPE';
  return null;
}

function validateUpdateFood(cmd: UpdateFoodEntry): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.entityId) return 'MISSING_ENTITY_ID';
  if (cmd.expectedRevision < 1) return 'INVALID_REVISION';
  return null;
}

function validateCreateCookingLog(cmd: CreateCookingLog): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.title?.trim()) return 'MISSING_TITLE';
  if (!cmd.payload.cookedAt) return 'MISSING_COOKED_AT';
  if (!cmd.payload.mealType) return 'MISSING_MEAL_TYPE';
  return null;
}

function validateCreateItem(cmd: CreateItemEntry): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.title?.trim()) return 'MISSING_TITLE';
  if (!cmd.payload.occurredAt) return 'MISSING_OCCURRED_AT';
  if (!cmd.payload.item) return 'MISSING_ITEM';
  if (!cmd.payload.item.category?.trim()) return 'MISSING_CATEGORY';
  if (!cmd.payload.item.lifecycleState) return 'MISSING_LIFECYCLE_STATE';
  if (!cmd.payload.item.startDate) return 'MISSING_START_DATE';
  return null;
}

function validateAppendLifecycle(cmd: AppendItemLifecycleEvent): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.itemEntryId) return 'MISSING_ITEM_ENTRY_ID';
  if (cmd.expectedItemRevision < 1) return 'INVALID_REVISION';
  if (!cmd.payload.to) return 'MISSING_TO_STATE';
  if (!cmd.payload.action) return 'MISSING_ACTION';
  if (!cmd.payload.reason?.trim()) return 'MISSING_REASON';
  if (!cmd.payload.emotion?.trim()) return 'MISSING_EMOTION';
  return null;
}

function validateCreateFinancial(cmd: CreateFinancialEntry): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.title?.trim()) return 'MISSING_TITLE';
  if (!cmd.payload.occurredAt) return 'MISSING_OCCURRED_AT';
  if (!cmd.payload.monetary) return 'MISSING_MONETARY';
  if (typeof cmd.payload.monetary.amountMinor !== 'number' || !Number.isFinite(cmd.payload.monetary.amountMinor)) return 'INVALID_AMOUNT_MINOR';
  if (!cmd.payload.monetary.currency) return 'MISSING_CURRENCY';
  if (!cmd.payload.monetary.accountId) return 'MISSING_ACCOUNT_ID';
  if (!cmd.payload.monetary.categoryId) return 'MISSING_CATEGORY_ID';
  return null;
}

function validateCreateRecipe(cmd: CreateRecipe): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.title?.trim()) return 'MISSING_TITLE';
  if (!cmd.payload.category?.trim()) return 'MISSING_CATEGORY';
  if (!Array.isArray(cmd.payload.ingredients)) return 'INVALID_INGREDIENTS';
  if (!Array.isArray(cmd.payload.steps)) return 'INVALID_STEPS';
  return null;
}

function validateCreateReceipt(cmd: CreateDietReceipt): string | null {
  if (!cmd.commandId) return 'MISSING_COMMAND_ID';
  if (!cmd.payload.date) return 'MISSING_DATE';
  if (!Array.isArray(cmd.payload.mealEntryIds)) return 'INVALID_MEAL_ENTRY_IDS';
  if (!cmd.payload.totals) return 'MISSING_TOTALS';
  return null;
}

function validateCommand(cmd: LifeLedgerCommand): string | null {
  switch (cmd.type) {
    case 'CreateFoodEntry': return validateCreateFood(cmd);
    case 'UpdateFoodEntry': return validateUpdateFood(cmd);
    case 'DeleteFoodEntry': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
    case 'CreateCookingLog': return validateCreateCookingLog(cmd);
    case 'UpdateCookingLog': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_UPDATE_COMMAND';
    case 'DeleteCookingLog': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
    case 'CreateItemEntry': return validateCreateItem(cmd);
    case 'UpdateItemEntry': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_UPDATE_COMMAND';
    case 'DeleteItemEntry': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
    case 'AppendItemLifecycleEvent': return validateAppendLifecycle(cmd);
    case 'CreateFinancialEntry': return validateCreateFinancial(cmd);
    case 'UpdateFinancialEntry': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_UPDATE_COMMAND';
    case 'DeleteFinancialEntry': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
    case 'CreateRecipe': return validateCreateRecipe(cmd);
    case 'UpdateRecipe': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_UPDATE_COMMAND';
    case 'DeleteRecipe': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
    case 'CreateDietReceipt': return validateCreateReceipt(cmd);
    case 'DeleteDietReceipt': return cmd.commandId && cmd.entityId && cmd.expectedRevision >= 1 ? null : 'INVALID_DELETE_COMMAND';
  }
}

/* ══════════════════════════════════════
   Provenance Helper
   ══════════════════════════════════════ */

function nativeSource(): LifeLedgerSource {
  return { owner: LIFE_LEDGER_NATIVE_SOURCE_OWNER, legacyId: '', migrationVersion: 0 };
}

/* ══════════════════════════════════════
   Mutation Service
   ══════════════════════════════════════ */

export class LifeLedgerMutationService {
  private readonly repository: LifeLedgerRepository;

  constructor(repository: LifeLedgerRepository) {
    this.repository = repository;
  }

  async execute(command: LifeLedgerCommand): Promise<MutationResult> {
    const validationError = validateCommand(command);
    if (validationError) return reject(validationError);

    const now = command.timestamp ?? new Date().toISOString();

    switch (command.type) {
      case 'CreateFoodEntry': return this.createFood(command, now);
      case 'UpdateFoodEntry': return this.updateFood(command, now);
      case 'DeleteFoodEntry': return this.softDeleteEntry(command, 'food', now);
      case 'CreateCookingLog': return this.createCookingLog(command, now);
      case 'UpdateCookingLog': return this.updateCookingLog(command, now);
      case 'DeleteCookingLog': return this.softDeleteCookingLog(command, now);
      case 'CreateItemEntry': return this.createItem(command, now);
      case 'UpdateItemEntry': return this.updateItem(command, now);
      case 'DeleteItemEntry': return this.softDeleteEntry(command, 'item', now);
      case 'AppendItemLifecycleEvent': return this.appendLifecycleEvent(command, now);
      case 'CreateFinancialEntry': return this.createFinancial(command, now);
      case 'UpdateFinancialEntry': return this.updateFinancial(command, now);
      case 'DeleteFinancialEntry': return this.softDeleteEntry(command, command.type === 'DeleteFinancialEntry' ? 'expense' : 'expense', now);
      case 'CreateRecipe': return this.createRecipe(command, now);
      case 'UpdateRecipe': return this.updateRecipe(command, now);
      case 'DeleteRecipe': return this.hardDeleteRecipe(command, now);
      case 'CreateDietReceipt': return this.createReceipt(command, now);
      case 'DeleteDietReceipt': return this.hardDeleteReceipt(command, now);
    }
  }

  private async createFood(cmd: CreateFoodEntry, now: string): Promise<MutationResult> {
    const id = `food:${cmd.commandId}`;
    const entry: LifeLedgerEntry = {
      id,
      type: 'food',
      title: cmd.payload.title.trim(),
      occurredAt: cmd.payload.occurredAt,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      commandId: cmd.commandId,
      source: nativeSource(),
      notes: cmd.payload.notes,
      tags: cmd.payload.tags,
      assetId: cmd.payload.assetId,
      food: { ...cmd.payload.food },
    };
    await this.repository.put('entries', [entry]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['entries'] };
  }

  private async updateFood(cmd: UpdateFoodEntry, now: string): Promise<MutationResult> {
    return this.updateEntry(cmd.entityId, cmd.expectedRevision, cmd.commandId, now, (existing) => ({
      ...existing,
      title: cmd.payload.title?.trim() ?? existing.title,
      occurredAt: cmd.payload.occurredAt ?? existing.occurredAt,
      notes: cmd.payload.notes ?? existing.notes,
      tags: cmd.payload.tags ?? existing.tags,
      assetId: cmd.payload.assetId ?? existing.assetId,
      food: cmd.payload.food ? { ...existing.food, ...cmd.payload.food } as LifeLedgerEntry['food'] : existing.food,
    }));
  }

  private async createCookingLog(cmd: CreateCookingLog, now: string): Promise<MutationResult> {
    const id = `cook:${cmd.commandId}`;
    const log: LifeLedgerCookingLog = {
      id,
      source: nativeSource(),
      title: cmd.payload.title.trim(),
      cookedAt: cmd.payload.cookedAt,
      updatedAt: now,
      mealType: cmd.payload.mealType,
      ingredients: cmd.payload.ingredients,
      steps: cmd.payload.steps,
      notes: cmd.payload.notes,
      tags: cmd.payload.tags,
      saveAsRecipe: cmd.payload.saveAsRecipe,
      recipeId: cmd.payload.recipeId,
      assetId: cmd.payload.assetId,
      revision: 1,
      commandId: cmd.commandId,
    };
    await this.repository.put('cooking_logs', [log]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['cooking_logs'] };
  }

  private async updateCookingLog(cmd: UpdateCookingLog, now: string): Promise<MutationResult> {
    const existing = await this.repository.getById('cooking_logs', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    if (existing.deletedAt) return reject('ENTITY_DELETED');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    const updated: LifeLedgerCookingLog = {
      ...existing,
      title: cmd.payload.title?.trim() ?? existing.title,
      cookedAt: cmd.payload.cookedAt ?? existing.cookedAt,
      mealType: cmd.payload.mealType ?? existing.mealType,
      ingredients: cmd.payload.ingredients ?? existing.ingredients,
      steps: cmd.payload.steps ?? existing.steps,
      notes: cmd.payload.notes ?? existing.notes,
      tags: cmd.payload.tags ?? existing.tags,
      saveAsRecipe: cmd.payload.saveAsRecipe ?? existing.saveAsRecipe,
      recipeId: cmd.payload.recipeId ?? existing.recipeId,
      assetId: cmd.payload.assetId ?? existing.assetId,
      updatedAt: now,
      revision: currentRevision + 1,
      commandId: cmd.commandId,
    };
    await this.repository.put('cooking_logs', [updated]);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['cooking_logs'] };
  }

  private async softDeleteCookingLog(cmd: DeleteCookingLog, now: string): Promise<MutationResult> {
    const existing = await this.repository.getById('cooking_logs', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    if (existing.deletedAt) return reject('ENTITY_ALREADY_DELETED');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    const deleted: LifeLedgerCookingLog = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      revision: currentRevision + 1,
      commandId: cmd.commandId,
    };
    await this.repository.put('cooking_logs', [deleted]);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['cooking_logs'] };
  }

  private async createItem(cmd: CreateItemEntry, now: string): Promise<MutationResult> {
    const id = `item:${cmd.commandId}`;
    const entry: LifeLedgerEntry = {
      id,
      type: 'item',
      title: cmd.payload.title.trim(),
      occurredAt: cmd.payload.occurredAt,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      commandId: cmd.commandId,
      source: nativeSource(),
      notes: cmd.payload.notes,
      tags: cmd.payload.tags,
      assetId: cmd.payload.assetId,
      item: { ...cmd.payload.item },
    };
    await this.repository.put('entries', [entry]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['entries'] };
  }

  private async updateItem(cmd: UpdateItemEntry, now: string): Promise<MutationResult> {
    return this.updateEntry(cmd.entityId, cmd.expectedRevision, cmd.commandId, now, (existing) => ({
      ...existing,
      title: cmd.payload.title?.trim() ?? existing.title,
      occurredAt: cmd.payload.occurredAt ?? existing.occurredAt,
      notes: cmd.payload.notes ?? existing.notes,
      tags: cmd.payload.tags ?? existing.tags,
      assetId: cmd.payload.assetId ?? existing.assetId,
      item: cmd.payload.item ? { ...existing.item, ...cmd.payload.item } as LifeLedgerEntry['item'] : existing.item,
    }));
  }

  private async appendLifecycleEvent(cmd: AppendItemLifecycleEvent, now: string): Promise<MutationResult> {
    const item = await this.repository.getById('entries', cmd.itemEntryId);
    if (!item) return reject('ITEM_NOT_FOUND');
    if (item.deletedAt) return reject('ITEM_DELETED');
    const currentItemRevision = item.revision ?? 1;
    if (currentItemRevision !== cmd.expectedItemRevision) return conflict(cmd.itemEntryId, currentItemRevision);

    const existingEvents = await this.repository.getAll('item_lifecycle_events');
    const maxSeq = existingEvents
      .filter((e) => e.itemEntryId === cmd.itemEntryId)
      .reduce((max, e) => Math.max(max, e.sequence), 0);

    const eventId = `life:${cmd.commandId}`;
    const event: LifeLedgerItemLifecycleEvent = {
      id: eventId,
      itemEntryId: cmd.itemEntryId,
      sequence: maxSeq + 1,
      source: nativeSource(),
      from: cmd.payload.from,
      to: cmd.payload.to,
      action: cmd.payload.action,
      reason: cmd.payload.reason.trim(),
      emotion: cmd.payload.emotion.trim(),
      context: cmd.payload.context,
      note: cmd.payload.note,
      revision: 1,
      commandId: cmd.commandId,
      createdAt: now,
    };

    const updatedItem: LifeLedgerEntry = {
      ...item,
      item: item.item ? { ...item.item, lifecycleState: cmd.payload.to } : item.item,
      updatedAt: now,
      revision: currentItemRevision + 1,
      commandId: cmd.commandId,
    };

    await this.repository.withTransaction(['entries', 'item_lifecycle_events'], 'readwrite', async (tx) => {
      tx.put('entries', [updatedItem]);
      tx.put('item_lifecycle_events', [event]);
    });

    return {
      status: 'committed',
      entityId: cmd.itemEntryId,
      revision: currentItemRevision + 1,
      committedAt: now,
      affectedStores: ['entries', 'item_lifecycle_events'],
    };
  }

  private async createFinancial(cmd: CreateFinancialEntry, now: string): Promise<MutationResult> {
    const entryType = cmd.payload.monetary.amountMinor >= 0 ? 'income' as const : 'expense' as const;
    const id = `fin:${cmd.commandId}`;
    const entry: LifeLedgerEntry = {
      id,
      type: entryType,
      title: cmd.payload.title.trim(),
      occurredAt: cmd.payload.occurredAt,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      commandId: cmd.commandId,
      source: nativeSource(),
      notes: cmd.payload.notes,
      tags: cmd.payload.tags,
      monetary: {
        amountMinor: cmd.payload.monetary.amountMinor,
        currency: cmd.payload.monetary.currency,
        accountId: cmd.payload.monetary.accountId,
        categoryId: cmd.payload.monetary.categoryId,
        origin: cmd.payload.monetary.origin,
      },
    };
    await this.repository.put('entries', [entry]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['entries'] };
  }

  private async updateFinancial(cmd: UpdateFinancialEntry, now: string): Promise<MutationResult> {
    return this.updateEntry(cmd.entityId, cmd.expectedRevision, cmd.commandId, now, (existing) => ({
      ...existing,
      title: cmd.payload.title?.trim() ?? existing.title,
      occurredAt: cmd.payload.occurredAt ?? existing.occurredAt,
      notes: cmd.payload.notes ?? existing.notes,
      tags: cmd.payload.tags ?? existing.tags,
      monetary: cmd.payload.monetary ? { ...existing.monetary, ...cmd.payload.monetary } as LifeLedgerEntry['monetary'] : existing.monetary,
    }));
  }

  private async createRecipe(cmd: CreateRecipe, now: string): Promise<MutationResult> {
    const id = `recipe:${cmd.commandId}`;
    const recipe: LifeLedgerRecipe = {
      id,
      source: nativeSource(),
      title: cmd.payload.title.trim(),
      category: cmd.payload.category.trim(),
      ingredients: cmd.payload.ingredients,
      steps: cmd.payload.steps,
      tags: cmd.payload.tags,
      notes: cmd.payload.notes,
      isFavorite: cmd.payload.isFavorite,
      assetId: cmd.payload.assetId,
      revision: 1,
      commandId: cmd.commandId,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.put('recipes', [recipe]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['recipes'] };
  }

  private async updateRecipe(cmd: UpdateRecipe, now: string): Promise<MutationResult> {
    const existing = await this.repository.getById('recipes', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    if (existing.deletedAt) return reject('ENTITY_DELETED');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    const updated: LifeLedgerRecipe = {
      ...existing,
      title: cmd.payload.title?.trim() ?? existing.title,
      category: cmd.payload.category?.trim() ?? existing.category,
      ingredients: cmd.payload.ingredients ?? existing.ingredients,
      steps: cmd.payload.steps ?? existing.steps,
      tags: cmd.payload.tags ?? existing.tags,
      notes: cmd.payload.notes ?? existing.notes,
      isFavorite: cmd.payload.isFavorite ?? existing.isFavorite,
      assetId: cmd.payload.assetId ?? existing.assetId,
      updatedAt: now,
      revision: currentRevision + 1,
      commandId: cmd.commandId,
    };
    await this.repository.put('recipes', [updated]);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['recipes'] };
  }

  private async hardDeleteRecipe(cmd: DeleteRecipe, now: string): Promise<MutationResult> {
    const existing = await this.repository.getById('recipes', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    await this.repository.deleteById('recipes', cmd.entityId);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['recipes'] };
  }

  private async createReceipt(cmd: CreateDietReceipt, now: string): Promise<MutationResult> {
    const id = `receipt:${cmd.commandId}`;
    const receipt: LifeLedgerDietReceipt = {
      id,
      source: nativeSource(),
      date: cmd.payload.date,
      mealEntryIds: cmd.payload.mealEntryIds,
      totals: { ...cmd.payload.totals },
      viewed: cmd.payload.viewed,
      revision: 1,
      commandId: cmd.commandId,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.put('diet_receipts', [receipt]);
    return { status: 'committed', entityId: id, revision: 1, committedAt: now, affectedStores: ['diet_receipts'] };
  }

  private async hardDeleteReceipt(cmd: DeleteDietReceipt, now: string): Promise<MutationResult> {
    const existing = await this.repository.getById('diet_receipts', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    await this.repository.deleteById('diet_receipts', cmd.entityId);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['diet_receipts'] };
  }

  private async softDeleteEntry(
    cmd: { entityId: string; expectedRevision: number; commandId: string },
    _entryType: string,
    now: string,
  ): Promise<MutationResult> {
    const existing = await this.repository.getById('entries', cmd.entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    if (existing.deletedAt) return reject('ENTITY_ALREADY_DELETED');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== cmd.expectedRevision) return conflict(cmd.entityId, currentRevision);
    const deleted: LifeLedgerEntry = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      revision: currentRevision + 1,
      commandId: cmd.commandId,
    };
    await this.repository.put('entries', [deleted]);
    return { status: 'committed', entityId: cmd.entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['entries'] };
  }

  private async updateEntry(
    entityId: string,
    expectedRevision: number,
    commandId: string,
    now: string,
    updater: (existing: LifeLedgerEntry) => LifeLedgerEntry,
  ): Promise<MutationResult> {
    const existing = await this.repository.getById('entries', entityId);
    if (!existing) return reject('ENTITY_NOT_FOUND');
    if (existing.deletedAt) return reject('ENTITY_DELETED');
    const currentRevision = existing.revision ?? 1;
    if (currentRevision !== expectedRevision) return conflict(entityId, currentRevision);
    const updated = updater(existing);
    updated.updatedAt = now;
    updated.revision = currentRevision + 1;
    updated.commandId = commandId;
    await this.repository.put('entries', [updated]);
    return { status: 'committed', entityId, revision: currentRevision + 1, committedAt: now, affectedStores: ['entries'] };
  }
}
