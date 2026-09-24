/**
 * Exchange utility — initial pair resolution (Life Utility Phase C).
 *
 * Canonical owners are unchanged: rates + provider live in
 * `src/store/useExchangeRateStore.ts` (persist `lunartide_exchange_rates_v2`) and
 * `src/utils/exchangeRateProvider.ts`. This module only decides which pair the
 * utility may open on, so it never starts on an unsupported pair.
 */

export const EXCHANGE_FALLBACK_SOURCE = 'TWD';
export const EXCHANGE_FALLBACK_TARGET = 'USD';

export function isSupportedCurrency(code: string | null | undefined, supported: readonly string[]): code is string {
  return typeof code === 'string' && supported.includes(code);
}

/** Both legs present in the loaded catalog (the only state worth requesting). */
export function isSupportedPair(source: string, target: string, supported: readonly string[]): boolean {
  return isSupportedCurrency(source, supported) && isSupportedCurrency(target, supported);
}

/**
 * Source priority: valid last-used pair → valid persisted recent preference →
 * neutral fallback → first supported currency.
 */
export function resolveSourceCurrency(candidates: readonly (string | null | undefined)[], supported: readonly string[]): string {
  for (const candidate of candidates) {
    if (isSupportedCurrency(candidate, supported)) return candidate;
  }
  if (supported.includes(EXCHANGE_FALLBACK_SOURCE)) return EXCHANGE_FALLBACK_SOURCE;
  if (supported.includes(EXCHANGE_FALLBACK_TARGET)) return EXCHANGE_FALLBACK_TARGET;
  return supported[0] ?? EXCHANGE_FALLBACK_SOURCE;
}

/** Target priority: persisted preference that differs from the source → neutral fallback → any other supported. */
export function resolveTargetCurrency(source: string, candidates: readonly (string | null | undefined)[], supported: readonly string[]): string {
  for (const candidate of candidates) {
    if (isSupportedCurrency(candidate, supported) && candidate !== source) return candidate;
  }
  if (EXCHANGE_FALLBACK_TARGET !== source && supported.includes(EXCHANGE_FALLBACK_TARGET)) return EXCHANGE_FALLBACK_TARGET;
  if (EXCHANGE_FALLBACK_SOURCE !== source && supported.includes(EXCHANGE_FALLBACK_SOURCE)) return EXCHANGE_FALLBACK_SOURCE;
  return supported.find((code) => code !== source) ?? source;
}
