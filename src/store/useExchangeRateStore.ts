/**
 * Exchange Rate Store — Phase 1.2 (canonical owner, unchanged by Phase C extraction)
 *
 * Persists `lunartide_exchange_rates_v2` v3: rate snapshot + last quote, the currency
 * catalog (24h fresh / 7d stale), favorites/recents and the last-used source currency.
 * Exchange UI lives in `src/features/exchange/` and the page at `/exchange`; this store
 * and `@/utils/exchangeRateProvider` remain the single canonical owners.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrencyInfo, ExchangeRateSnapshot, ExchangeRateQuote, ExchangeRateError as ExErr, CurrencyCatalogItem } from '@/utils/exchangeRateProvider';
import { defaultExchangeRateProvider, ExchangeRateError, classifyFetchError, ERROR_SAFE_MESSAGES, fetchCurrencyCatalog, normalizeCurrencyCatalogResponse } from '@/utils/exchangeRateProvider';

const RATE_STORE_KEY = 'lunartide_exchange_rates_v2';

const FRESH_TTL_MS = 60 * 60 * 1000;
const CATALOG_FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUP_WINDOW_MS = 30_000;

/** Chinese display names for common currencies. Falls back to API name + code. */
const CHINESE_CURRENCY_NAMES: Record<string, string> = {
  CNY: '人民幣', USD: '美元', EUR: '歐元', JPY: '日元', KRW: '韓元',
  GBP: '英鎊', HKD: '港元', TWD: '新台幣', AUD: '澳元', CAD: '加元',
  CHF: '瑞士法郎', SGD: '新加坡元', SEK: '瑞典克朗', NOK: '挪威克朗',
  DKK: '丹麥克朗', NZD: '紐西蘭元', THB: '泰銖', MYR: '馬來西亞令吉',
  PHP: '菲律賓披索', IDR: '印尼盾', INR: '印度盧比', VND: '越南盾',
  MXN: '墨西哥披索', BRL: '巴西雷亞爾', ARS: '阿根廷披索', CLP: '智利披索',
  COP: '哥倫比亞披索', RUB: '俄羅斯盧布', TRY: '土耳其里拉', ZAR: '南非蘭特',
  AED: '阿聯酋迪拉姆', SAR: '沙特里亞爾', PLN: '波蘭茲羅提', CZK: '捷克克朗',
  HUF: '匈牙利福林', ILS: '以色列新謝克爾', RON: '羅馬尼亞列伊', ISK: '冰島克朗',
};

function getCurrencyDisplayName(code: string, apiName: string): string {
  return CHINESE_CURRENCY_NAMES[code] ?? `${apiName} (${code})`;
}

/**
 * English name aliases for search, keyed by LOWERCASE currency code.
 * Lookups must normalize the code (`CURRENCY_ENGLISH_ALIASES[code.toLowerCase()]`) —
 * the Phase C extraction fixed the previous exact-case lookup that never matched.
 */
export const CURRENCY_ENGLISH_ALIASES: Record<string, string[]> = {
  cny: ['yuan', 'renminbi', 'rmb'],
  usd: ['us dollar', 'buck'],
  eur: ['euro'],
  jpy: ['yen'],
  krw: ['won'],
  gbp: ['pound', 'sterling'],
  hkd: ['hong kong dollar'],
  twd: ['new taiwan dollar'],
  aud: ['australian dollar'],
  cad: ['canadian dollar'],
  chf: ['swiss franc'],
  sgd: ['singapore dollar'],
  nzd: ['new zealand dollar'],
  thb: ['baht'],
  myr: ['ringgit'],
  inr: ['rupee'],
  zar: ['rand', 'south african rand'],
};

export type ExchangeRateStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';
export type CatalogState = 'idle' | 'loading' | 'ready' | 'error';

interface CachedQuote {
  base: string; quote: string; rate: number; inverseRate: number;
  providerId: string; fetchedAt: number; rateUpdatedAt?: number;
}

interface ExchangeRateState {
  currencies: CurrencyInfo[];
  catalogState: CatalogState;
  catalogItems: CurrencyCatalogItem[];
  catalogFetchedAt: number;
  catalogStale: boolean;
  snapshot: ExchangeRateSnapshot | null;
  lastQuote: CachedQuote | null;
  status: ExchangeRateStatus;
  lastError: ExErr | null;
  favoriteIds: string[];
  recentIds: string[];
  lastUsedSourceCurrency: string;

  _currenciesAbort: AbortController | null;
  _fetchAbort: AbortController | null;
  _fetchGen: number;
  _lastFetchPair: string;
  _lastFetchTime: number;

  loadCurrencies: () => Promise<void>;
  fetchRates: (baseCurrency: string, targetCurrency?: string) => Promise<void>;
  addFavorite: (code: string) => void;
  removeFavorite: (code: string) => void;
  addRecent: (code: string) => void;
  setLastUsedSourceCurrency: (code: string) => void;
  clearCache: () => void;
}

export function decimalMultiply(a: number, b: number): number {
  const aStr = String(a), bStr = String(b);
  const aDec = aStr.includes('.') ? aStr.split('.')[1].length : 0;
  const bDec = bStr.includes('.') ? bStr.split('.')[1].length : 0;
  const factor = Math.pow(10, Math.max(aDec, bDec));
  return (Math.round(a * factor) * Math.round(b * factor)) / (factor * factor);
}

function isFresh(fetchedAt: number): boolean { return Date.now() - fetchedAt < FRESH_TTL_MS; }
function isValid(fetchedAt: number): boolean { return Date.now() - fetchedAt < STALE_TTL_MS; }
function isOnline() { return typeof navigator === 'undefined' || navigator.onLine; }

function catalogIsFresh(fetchedAt: number): boolean { return Date.now() - fetchedAt < CATALOG_FRESH_TTL_MS; }
function catalogIsValid(fetchedAt: number): boolean { return Date.now() - fetchedAt < CATALOG_STALE_TTL_MS; }

export const useExchangeRateStore = create<ExchangeRateState>()(
  persist(
    (set, get) => ({
      currencies: [],
      catalogState: 'idle',
      catalogItems: [],
      catalogFetchedAt: 0,
      catalogStale: false,
      snapshot: null, lastQuote: null,
      status: 'idle', lastError: null,
      favoriteIds: [], recentIds: [],
      lastUsedSourceCurrency: 'CNY',
      _currenciesAbort: null, _fetchAbort: null,
      _fetchGen: 0, _lastFetchPair: '', _lastFetchTime: 0,

      loadCurrencies: async () => {
        const { catalogItems, catalogFetchedAt, _currenciesAbort } = get();

        // Already loaded and fresh
        if (catalogItems.length > 0 && catalogIsFresh(catalogFetchedAt)) return;

        // Stale but valid — keep showing data, revalidate in background
        const hasStale = catalogItems.length > 0 && catalogIsValid(catalogFetchedAt) && !catalogIsFresh(catalogFetchedAt);
        if (hasStale) set({ catalogStale: true });

        _currenciesAbort?.abort();
        const abort = new AbortController();
        set({ _currenciesAbort: abort, catalogState: catalogItems.length > 0 ? 'ready' : 'loading' });

        try {
          const items = await fetchCurrencyCatalog(abort.signal);
          if (abort.signal.aborted) return;
          const currencies: CurrencyInfo[] = items.map((item) => ({
            code: item.code,
            displayName: getCurrencyDisplayName(item.code, item.name),
            symbol: item.symbol,
            decimalDigits: 2, // will be enriched by getSymbolMeta later
          }));
          set({ currencies, catalogItems: items, catalogFetchedAt: Date.now(), catalogState: 'ready', catalogStale: false });
        } catch (err) {
          if (abort.signal.aborted) return;
          if (err instanceof ExchangeRateError && err.type === 'aborted') return;
          // Keep stale data if available
          if (catalogItems.length > 0) {
            set({ catalogState: 'ready', catalogStale: true, lastError: classifyFetchError(err, 'system') });
          } else {
            set({ catalogState: 'error', lastError: classifyFetchError(err, 'system') });
          }
        }
      },

      fetchRates: async (baseCurrency: string, targetCurrency?: string) => {
        if (!baseCurrency) { set({ status: 'idle', lastError: null }); return; }
        const { snapshot, lastQuote } = get();
        const pairKey = targetCurrency ? `${baseCurrency}/${targetCurrency}` : baseCurrency;
        const now = Date.now();
        const state = get();
        if (state._lastFetchPair === pairKey && now - state._lastFetchTime < DEDUP_WINDOW_MS) return;

        state._fetchAbort?.abort();
        const abort = new AbortController();
        const gen = state._fetchGen + 1;
        set({ _fetchAbort: abort, _fetchGen: gen, _lastFetchPair: pairKey, _lastFetchTime: now });

        const cachedOk = snapshot && snapshot.base === baseCurrency;
        if (cachedOk && isFresh(snapshot.fetchedAt) && !targetCurrency) {
          set({ status: 'ready', lastError: null }); return;
        }
        if (cachedOk && !isFresh(snapshot.fetchedAt)) set({ status: 'stale', lastError: null });

        if (!isOnline()) {
          if (cachedOk && isValid(snapshot.fetchedAt)) { set({ status: 'stale', lastError: null }); return; }
          set({ status: 'error', lastError: new ExchangeRateError({ type: 'offline', message: 'Offline', safeMessage: ERROR_SAFE_MESSAGES.offline }) });
          return;
        }

        set({ status: 'loading', lastError: null });

        try {
          if (targetCurrency) {
            const quote = await defaultExchangeRateProvider.getQuote(baseCurrency, targetCurrency, abort.signal);
            if (gen !== get()._fetchGen) return;
            set({ lastQuote: { base: quote.base, quote: quote.quote, rate: quote.rate, inverseRate: quote.inverseRate, providerId: quote.providerId, fetchedAt: quote.fetchedAt, rateUpdatedAt: quote.rateUpdatedAt }, status: 'ready', lastError: null });
          } else {
            const newSnapshot = await defaultExchangeRateProvider.getLatestRates(baseCurrency, abort.signal);
            if (gen !== get()._fetchGen) return;
            set({ snapshot: newSnapshot, status: 'ready', lastError: null });
          }
        } catch (err) {
          if (gen !== get()._fetchGen) return;
          const exErr = err instanceof ExchangeRateError ? err : classifyFetchError(err, 'system');
          if (exErr.type === 'aborted') return;
          if (cachedOk && isValid(snapshot.fetchedAt)) set({ status: 'stale', lastError: exErr });
          else set({ status: 'error', lastError: exErr });
        }
      },

      addFavorite: (code) => set((s) => { if (s.favoriteIds.includes(code)) return s; return { favoriteIds: [code, ...s.favoriteIds].slice(0, 20) }; }),
      removeFavorite: (code) => set((s) => ({ favoriteIds: s.favoriteIds.filter((c) => c !== code) })),
      addRecent: (code) => set((s) => { const f = s.recentIds.filter((c) => c !== code); return { recentIds: [code, ...f].slice(0, 10) }; }),
      setLastUsedSourceCurrency: (code) => set({ lastUsedSourceCurrency: code }),
      clearCache: () => { get()._fetchAbort?.abort(); set({ snapshot: null, lastQuote: null, status: 'idle', lastError: null }); },
    }),
    {
      name: RATE_STORE_KEY,
      version: 3,
      partialize: (state) => ({
        snapshot: state.snapshot,
        lastQuote: state.lastQuote,
        currencies: state.currencies,
        catalogItems: state.catalogItems,
        catalogFetchedAt: state.catalogFetchedAt,
        favoriteIds: state.favoriteIds,
        recentIds: state.recentIds,
        lastUsedSourceCurrency: state.lastUsedSourceCurrency,
      }),
      // Migration: if old cache has empty catalog, clear it to force re-fetch
      merge: (persisted: unknown, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const p = persisted as Record<string, unknown>;
        // Clear empty catalog caches
        const items = p.catalogItems as unknown[];
        if (Array.isArray(items) && items.length === 0) {
          return { ...current, currencies: [], catalogItems: [], catalogFetchedAt: 0 };
        }
        return { ...current, ...p };
      },
    },
  ),
);
