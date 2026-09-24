import type { StoreApi } from 'zustand';
import type { AppData, AppActions } from '@/store/useAppStore';
import type { MomentsAgentDevHarness } from '@/features/moments/agentTools';

declare global {
  interface Window {
    __store?: StoreApi<AppData & AppActions & { aiTyping: boolean; rhythmReceipts: unknown[] }>;
    __LUNARTIDE_MOMENTS_AGENT_TEST__?: MomentsAgentDevHarness;
  }
}

export {};
import type { LifeLedgerMigrationDiagnosticReport } from '@/features/lifeLedger/diagnostics';

declare global {
  interface Window {
    __LUNARTIDE_LIFE_LEDGER_AUDIT__?: () => Promise<LifeLedgerMigrationDiagnosticReport>;
  }
}

export {};
