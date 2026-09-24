import type { ProviderUsageRecord } from './apiUsageTypes';
import { IndexedDbProviderUsageRepository, type ProviderUsageRepository } from './providerUsageRepository';

export class ProviderUsageLedger {
  private readonly repository: ProviderUsageRepository;
  constructor(repository: ProviderUsageRepository) { this.repository = repository; }
  async record(record: ProviderUsageRecord): Promise<void> { await this.repository.add(record); }
  async getAll(): Promise<ProviderUsageRecord[]> { return this.repository.getAll(); }
  async clear(): Promise<void> { return this.repository.clear(); }
}

let canonicalLedger: ProviderUsageLedger | undefined;

export function getProviderUsageLedger(): ProviderUsageLedger {
  canonicalLedger ||= new ProviderUsageLedger(new IndexedDbProviderUsageRepository());
  return canonicalLedger;
}

export function setProviderUsageLedgerForTests(ledger?: ProviderUsageLedger): void {
  canonicalLedger = ledger;
}
