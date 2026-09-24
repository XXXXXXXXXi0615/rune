import { LIFE_LEDGER_DB_VERSION, type LifeLedgerMigrationStatus } from './domain';
import { lifeLedgerRepository, type LifeLedgerRepository } from './repository';

export interface LifeLedgerMigrationDiagnosticReport {
  databaseVersion: number;
  schemaVersion: number;
  migrationVersion: number | null;
  status: LifeLedgerMigrationStatus | 'not_run';
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  sourceChecksumsPresent: boolean;
  targetChecksumsPresent: boolean;
  sourceChecksums: Record<string, string>;
  targetChecksums: Record<string, string>;
  duplicateSourceIdentityCount: number;
  failedAssetCount: number;
  unresolvedRecordCount: number;
  cookingLog: {
    sourceCount: number;
    targetCount: number;
    classification: 'independent' | 'unknown';
  };
  legacySourcesStillPresent: boolean;
  lastMigrationAt: string | null;
  lastVerificationAt: string | null;
}

export async function getLifeLedgerMigrationReport(
  repository: Pick<LifeLedgerRepository, 'getAll'> = lifeLedgerRepository,
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
): Promise<LifeLedgerMigrationDiagnosticReport> {
  const metas = await repository.getAll('migration_meta');
  const latest = [...metas].sort((a, b) => b.migrationVersion - a.migrationVersion)[0];
  const sourceChecksums = Object.fromEntries((latest?.source ?? []).map((item) => [item.key, item.checksum]));
  const targetChecksums = Object.fromEntries((latest?.target ?? []).map((item) => [item.key, item.checksum]));
  return {
    databaseVersion: LIFE_LEDGER_DB_VERSION,
    schemaVersion: latest?.schemaVersion ?? LIFE_LEDGER_DB_VERSION,
    migrationVersion: latest?.migrationVersion ?? null,
    status: latest?.status ?? 'not_run',
    sourceCounts: { ...(latest?.verification?.sourceCounts ?? {}) },
    targetCounts: { ...(latest?.verification?.targetCounts ?? {}) },
    sourceChecksumsPresent: Boolean(latest?.source.length && latest.source.every((item) => Boolean(item.checksum))),
    targetChecksumsPresent: Boolean(latest?.target.length && latest.target.every((item) => Boolean(item.checksum))),
    sourceChecksums,
    targetChecksums,
    duplicateSourceIdentityCount: latest?.verification?.duplicateCount ?? 0,
    failedAssetCount: latest?.verification?.failedAssetCount ?? 0,
    unresolvedRecordCount: latest?.verification?.unresolvedRecordCount ?? 0,
    cookingLog: {
      sourceCount: latest?.verification?.sourceCounts.cookingLogs ?? 0,
      targetCount: latest?.verification?.targetCounts.cookingLogs ?? 0,
      classification: latest?.cookingLogStrategy.classification ?? 'unknown',
    },
    legacySourcesStillPresent: Boolean(storage?.getItem('lunartide_data') !== null && storage?.getItem('lunartide_object_memory') !== null),
    lastMigrationAt: latest?.completedAt ?? latest?.startedAt ?? null,
    lastVerificationAt: latest?.verifiedAt ?? null,
  };
}

export function installLifeLedgerDevAudit(isDev = import.meta.env.DEV): void {
  if (!isDev || typeof window === 'undefined') return;
  window.__LUNARTIDE_LIFE_LEDGER_AUDIT__ = async () => {
    const report = await getLifeLedgerMigrationReport();
    console.table(report);
    return report;
  };
}
