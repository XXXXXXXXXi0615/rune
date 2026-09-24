export const LIFE_LEDGER_DB_NAME = 'lunartide-life-ledger-v1';
export const LIFE_LEDGER_DB_VERSION = 2;
export const LIFE_LEDGER_MIGRATION_VERSION = 2;
export const LIFE_LEDGER_ID_SCHEME_VERSION = 1;
export const LIFE_LEDGER_NATIVE_SOURCE_OWNER = 'life-ledger' as const;

export type LifeLedgerEntryType = 'expense' | 'income' | 'food' | 'item';
export type LifeLedgerSourceOwner = 'diet' | 'object-memory' | 'money-transaction' | 'life-ledger';

export interface LifeLedgerSource {
  owner: LifeLedgerSourceOwner;
  legacyId: string;
  migrationVersion: number;
}

export interface LifeLedgerAssetMigration {
  status: 'not_applicable' | 'existing_verified' | 'migrated' | 'failed';
  assetId?: string;
  errorCode?: string;
}

export interface LifeLedgerEntry {
  id: string;
  type: LifeLedgerEntryType;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  deletedAt?: string;
  commandId?: string;
  source: LifeLedgerSource;
  notes?: string;
  tags?: string[];
  assetId?: string;
  assetMigration?: LifeLedgerAssetMigration;
  monetary?: {
    amountMinor: number;
    currency: string;
    accountId: string;
    categoryId: string;
    origin: 'manual' | 'chat' | 'import';
    relatedEntryId?: string;
    exchangeRate?: number;
    convertedAmountMinor?: number;
    convertedCurrency?: string;
  };
  food?: {
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    status: 'eaten' | 'skipped' | 'missing';
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    water?: number;
    mood?: string;
  };
  item?: {
    category: string;
    lifecycleState: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
    startDate: string;
    endDate?: string;
    usageDays: number;
  };
}

export interface LifeLedgerRecipe {
  id: string;
  source: LifeLedgerSource;
  title: string;
  category: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  notes?: string;
  isFavorite: boolean;
  assetId?: string;
  assetMigration?: LifeLedgerAssetMigration;
  revision?: number;
  deletedAt?: string;
  commandId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeLedgerItemLifecycleEvent {
  id: string;
  itemEntryId: string;
  sequence: number;
  source: LifeLedgerSource;
  from?: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
  to: 'active' | 'idle' | 'aging' | 'farewell' | 'retired';
  action: 'created' | 'transitioned' | 'edited';
  reason: string;
  emotion: string;
  context?: string;
  note?: string;
  revision?: number;
  commandId?: string;
  createdAt: string;
}

export interface LifeLedgerDietReceipt {
  id: string;
  source: LifeLedgerSource;
  date: string;
  mealEntryIds: string[];
  totals: { calories: number; protein: number; carbs: number; fat: number; water: number };
  viewed: boolean;
  memoryEntryId?: string;
  savedToSecondBrainAt?: string;
  revision?: number;
  commandId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeLedgerCookingLog {
  id: string;
  source: LifeLedgerSource;
  title: string;
  cookedAt: string;
  updatedAt: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ingredients?: string[];
  steps?: string[];
  notes?: string;
  tags?: string[];
  saveAsRecipe: boolean;
  recipeId?: string;
  assetId?: string;
  assetMigration?: LifeLedgerAssetMigration;
  revision?: number;
  deletedAt?: string;
  commandId?: string;
}

export const COOKING_LOG_CLASSIFICATION = 'independent' as const;

export type LifeLedgerMigrationStatus = 'pending' | 'migrating' | 'verification_failed' | 'verified';

export interface LifeLedgerMigrationDatasetMeta {
  key: string;
  schemaVersion?: number;
  recordCount: number;
  checksum: string;
}

export interface LifeLedgerVerificationReport {
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  nutritionTotals: Record<string, number>;
  monetaryTotals: Record<string, number>;
  lifecycleOrderPreserved: boolean;
  readableAssetCount: number;
  failedAssetCount: number;
  duplicateCount: number;
  legacyBytesUnchanged: boolean;
  missingRatesRemainUndefined: boolean;
  unresolvedRecordCount: number;
  errors: string[];
}

export interface LifeLedgerMigrationMeta {
  migrationVersion: number;
  schemaVersion: number;
  startedAt: string;
  completedAt?: string;
  verifiedAt?: string;
  status: LifeLedgerMigrationStatus;
  source: LifeLedgerMigrationDatasetMeta[];
  target: LifeLedgerMigrationDatasetMeta[];
  verification?: LifeLedgerVerificationReport;
  failureSummary: string[];
  cookingLogStrategy: {
    classification: typeof COOKING_LOG_CLASSIFICATION;
    migration: 'canonical cooking_logs store';
  };
}

export function canonicalLifeLedgerId(owner: LifeLedgerSourceOwner, legacyId: string): string {
  return `life-ledger:v${LIFE_LEDGER_ID_SCHEME_VERSION}:${owner}:${legacyId}`;
}
