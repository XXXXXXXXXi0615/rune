import type { ProviderCapabilities } from './apiUsageTypes';

export function getApiUsageProviderCapabilities(providerId: string): ProviderCapabilities {
  return { balanceQuery: providerId === 'custom' ? 'unknown' : 'unsupported' };
}
