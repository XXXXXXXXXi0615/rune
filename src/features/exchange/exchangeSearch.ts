/**
 * Exchange currency search contract (Life Utility Phase C).
 *
 * Matches code, Chinese display name, symbol and the English alias map — all
 * case-insensitive. The alias map is keyed by LOWERCASE code, so the lookup
 * normalizes; the previous exact-case lookup never matched (fixed here).
 */
import { CURRENCY_ENGLISH_ALIASES } from '@/store/useExchangeRateStore';
import type { CurrencyInfo } from '@/utils/exchangeRateProvider';

export function currencyMatchesQuery(currency: Pick<CurrencyInfo, 'code' | 'displayName' | 'symbol'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    currency.code.toLowerCase().includes(q) ||
    currency.displayName.toLowerCase().includes(q) ||
    Boolean(currency.symbol && currency.symbol.toLowerCase().includes(q)) ||
    (CURRENCY_ENGLISH_ALIASES[currency.code.toLowerCase()]?.some((alias) => alias.includes(q)) ?? false)
  );
}
