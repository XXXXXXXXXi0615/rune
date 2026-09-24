/**
 * Exchange Rate Provider Adapter
 *
 * Phase 1.2: v2 catalog (160+ currencies), base/symbols Quote URL,
 *            CurrencyCatalogItem, normalizeCurrencyCatalogResponse,
 *            independent catalog cache.
 *
 * Provider: Frankfurter API (free, no API key)
 * v1 Base: api.frankfurter.dev/v1  (30 currencies, Record<string,string>)
 * v2 Base: api.frankfurter.dev/v2  (160+ currencies, Array<DTO>)
 */

/* ══════════════════════════════════════
   Types
   ══════════════════════════════════════ */

export interface CurrencyInfo {
  code: string;
  displayName: string;
  symbol: string;
  decimalDigits: number;
}

export interface CurrencyCatalogItem {
  code: string;       // uppercase ISO code
  name: string;       // English name
  symbol: string;     // from catalog or fallback
  startDate?: string;
  endDate?: string;
  active: boolean;    // endDate not expired
}

export interface ExchangeRateSnapshot {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
  /** Date the rate data was published by the provider (may differ from fetch time). */
  rateUpdatedAt?: number;
  providerId: string;
}

export interface ExchangeRateQuote {
  base: string;
  quote: string;
  rate: number;
  inverseRate: number;
  fetchedAt: number;
  /** Date the rate data was published by the provider. Falls back to fetchedAt if not available. */
  rateUpdatedAt?: number;
  providerId: string;
}

export type ExchangeRateErrorType =
  | 'offline' | 'timeout' | 'unauthorized' | 'rate_limited'
  | 'provider_unavailable' | 'cors' | 'invalid_pair'
  | 'invalid_response' | 'aborted' | 'unknown';

export class ExchangeRateError extends Error {
  type: ExchangeRateErrorType;
  httpStatus?: number;
  providerId?: string;
  retryAfter?: number;
  occurredAt: number;
  safeMessage: string;

  constructor(input: {
    type: ExchangeRateErrorType;
    message: string;
    safeMessage: string;
    httpStatus?: number;
    providerId?: string;
    retryAfter?: number;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = 'ExchangeRateError';
    this.type = input.type;
    this.httpStatus = input.httpStatus;
    this.providerId = input.providerId;
    this.retryAfter = input.retryAfter;
    this.occurredAt = Date.now();
    this.safeMessage = input.safeMessage;
    if (input.cause) this.cause = input.cause as Error;
  }
}

export const ERROR_SAFE_MESSAGES: Record<ExchangeRateErrorType, string> = {
  offline: '無網路連線',
  timeout: '請求逾時，請稍後重試',
  unauthorized: '匯率服務配置錯誤',
  rate_limited: '請求次數過多，請稍後再試',
  provider_unavailable: '匯率服務暫時無法使用',
  cors: '網路連線異常',
  invalid_pair: '不支援此貨幣組合',
  invalid_response: '匯率資料格式異常',
  aborted: '請求已取消',
  unknown: '發生未知錯誤',
};

export interface ExchangeRateProvider {
  id: string;
  label: string;
  description?: string;
  getSupportedCurrencies(signal?: AbortSignal): Promise<CurrencyInfo[]>;
  getLatestRates(baseCurrency: string, signal?: AbortSignal): Promise<ExchangeRateSnapshot>;
  getQuote(base: string, quote: string, signal?: AbortSignal): Promise<ExchangeRateQuote>;
}

/* ══════════════════════════════════════
   Common currency symbols & decimal digits
   ══════════════════════════════════════ */

const COMMON_SYMBOLS: Record<string, { symbol: string; decimalDigits: number }> = {
  CNY: { symbol: '¥', decimalDigits: 2 },
  USD: { symbol: '$', decimalDigits: 2 },
  EUR: { symbol: '€', decimalDigits: 2 },
  JPY: { symbol: '¥', decimalDigits: 0 },
  KRW: { symbol: '₩', decimalDigits: 0 },
  GBP: { symbol: '£', decimalDigits: 2 },
  HKD: { symbol: 'HK$', decimalDigits: 2 },
  TWD: { symbol: 'NT$', decimalDigits: 2 },
  AUD: { symbol: 'A$', decimalDigits: 2 },
  CAD: { symbol: 'C$', decimalDigits: 2 },
  CHF: { symbol: 'CHF', decimalDigits: 2 },
  SGD: { symbol: 'S$', decimalDigits: 2 },
  SEK: { symbol: 'kr', decimalDigits: 2 },
  NOK: { symbol: 'kr', decimalDigits: 2 },
  DKK: { symbol: 'kr', decimalDigits: 2 },
  NZD: { symbol: 'NZ$', decimalDigits: 2 },
  THB: { symbol: '฿', decimalDigits: 2 },
  MYR: { symbol: 'RM', decimalDigits: 2 },
  PHP: { symbol: '₱', decimalDigits: 2 },
  IDR: { symbol: 'Rp', decimalDigits: 0 },
  INR: { symbol: '₹', decimalDigits: 2 },
  VND: { symbol: '₫', decimalDigits: 0 },
  MXN: { symbol: 'Mex$', decimalDigits: 2 },
  BRL: { symbol: 'R$', decimalDigits: 2 },
  ARS: { symbol: 'AR$', decimalDigits: 2 },
  CLP: { symbol: 'CLP$', decimalDigits: 0 },
  COP: { symbol: 'COL$', decimalDigits: 0 },
  RUB: { symbol: '₽', decimalDigits: 2 },
  TRY: { symbol: '₺', decimalDigits: 2 },
  ZAR: { symbol: 'R', decimalDigits: 2 },
  AED: { symbol: 'د.إ', decimalDigits: 2 },
  SAR: { symbol: '﷼', decimalDigits: 2 },
  PLN: { symbol: 'zł', decimalDigits: 2 },
  CZK: { symbol: 'Kč', decimalDigits: 2 },
  HUF: { symbol: 'Ft', decimalDigits: 0 },
  ILS: { symbol: '₪', decimalDigits: 2 },
  RON: { symbol: 'RON', decimalDigits: 2 },
  ISK: { symbol: 'ISK', decimalDigits: 0 },
};

function getSymbolMeta(code: string): { symbol: string; decimalDigits: number } {
  return COMMON_SYMBOLS[code] ?? { symbol: code, decimalDigits: 2 };
}

function toCurrencyInfo(code: string, name: string): CurrencyInfo {
  const meta = getSymbolMeta(code);
  return { code, displayName: `${name} (${code})`, symbol: meta.symbol, decimalDigits: meta.decimalDigits };
}

/* ══════════════════════════════════════
   Error Classification
   ══════════════════════════════════════ */

export function classifyFetchError(err: unknown, providerId: string): ExchangeRateError {
  if (err instanceof ExchangeRateError) return err;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const name = err instanceof Error ? err.name : '';

  if (name === 'AbortError' || msg.includes('abort')) {
    return new ExchangeRateError({ type: 'aborted', message: msg, safeMessage: ERROR_SAFE_MESSAGES.aborted, providerId });
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new ExchangeRateError({ type: 'offline', message: msg, safeMessage: ERROR_SAFE_MESSAGES.offline, providerId });
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return new ExchangeRateError({ type: 'offline', message: msg, safeMessage: ERROR_SAFE_MESSAGES.offline, providerId, cause: err as Error });
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || name === 'TimeoutError') {
    return new ExchangeRateError({ type: 'timeout', message: msg, safeMessage: ERROR_SAFE_MESSAGES.timeout, providerId });
  }
  return new ExchangeRateError({ type: 'unknown', message: msg, safeMessage: ERROR_SAFE_MESSAGES.unknown, providerId, cause: err as Error });
}

export function classifyHttpError(status: number, providerId: string, retryAfter?: string | null): ExchangeRateError {
  if (status === 401 || status === 403) return new ExchangeRateError({ type: 'unauthorized', message: `HTTP ${status}`, safeMessage: ERROR_SAFE_MESSAGES.unauthorized, httpStatus: status, providerId });
  if (status === 429) { const r = retryAfter ? parseInt(retryAfter, 10) : undefined; return new ExchangeRateError({ type: 'rate_limited', message: 'HTTP 429', safeMessage: ERROR_SAFE_MESSAGES.rate_limited, httpStatus: status, providerId, retryAfter: r && !isNaN(r) ? r : undefined }); }
  if (status === 404) return new ExchangeRateError({ type: 'invalid_pair', message: 'HTTP 404', safeMessage: ERROR_SAFE_MESSAGES.invalid_pair, httpStatus: status, providerId });
  if (status >= 500) return new ExchangeRateError({ type: 'provider_unavailable', message: `HTTP ${status}`, safeMessage: ERROR_SAFE_MESSAGES.provider_unavailable, httpStatus: status, providerId });
  return new ExchangeRateError({ type: 'unknown', message: `HTTP ${status}`, safeMessage: ERROR_SAFE_MESSAGES.unknown, httpStatus: status, providerId });
}

/* ══════════════════════════════════════
   Rate Validation
   ══════════════════════════════════════ */

export function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value > 0 && !isNaN(value);
}

export function normalizeRate(raw: unknown, providerId: string, base: string, quote: string): number {
  if (!isValidRate(raw)) throw new ExchangeRateError({ type: 'invalid_response', message: `Invalid rate: ${JSON.stringify(raw)}`, safeMessage: ERROR_SAFE_MESSAGES.invalid_response, providerId });
  return raw;
}

/* ══════════════════════════════════════
   Currency Catalog — v2 primary, v1 fallback
   ══════════════════════════════════════ */

const V2_BASE = 'https://api.frankfurter.dev/v2';
const V1_BASE = 'https://api.frankfurter.dev/v1';
const FRANKFURTER_PROVIDER_ID = 'frankfurter';
const REQUEST_TIMEOUT_MS = 10000;

function frankfurterFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) { clearTimeout(timeoutId); controller.abort(); }
    else { signal.addEventListener('abort', () => { clearTimeout(timeoutId); controller.abort(); }, { once: true }); }
  }
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

/** V2 DTO shape */
interface FrankfurterV2Currency {
  iso_code: string;
  iso_numeric: string;
  name: string;
  symbol?: string;
  start_date?: string;
  end_date?: string;
}

/** Normalize v1 (Record<string,string>) or v2 (Array<DTO>) → CurrencyCatalogItem[] */
export function normalizeCurrencyCatalogResponse(
  raw: unknown,
): CurrencyCatalogItem[] {
  if (!raw) return [];

  // v2: Array of DTOs
  if (Array.isArray(raw)) {
    const items = new Map<string, CurrencyCatalogItem>();
    const now = new Date().toISOString().slice(0, 10);
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const dto = entry as FrankfurterV2Currency;
      const code = dto.iso_code?.trim().toUpperCase();
      const name = dto.name?.trim();
      if (!code || !name || code.length < 3) continue;
      // Dedup by code
      if (items.has(code)) continue;
      const endDate = dto.end_date?.trim() || undefined;
      const active = !endDate || endDate >= now;
      items.set(code, {
        code,
        name,
        symbol: dto.symbol?.trim() || getSymbolMeta(code).symbol,
        startDate: dto.start_date?.trim() || undefined,
        endDate,
        active,
      });
    }
    // Sort by code
    return Array.from(items.values()).sort((a, b) => a.code.localeCompare(b.code));
  }

  // v1: Record<string, string>
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const entries = Object.entries(record)
      .filter(([code, name]) => typeof code === 'string' && code.length >= 3 && typeof name === 'string' && name.trim().length > 0)
      .map(([code, name]) => {
        const uc = code.toUpperCase();
        return { code: uc, name: (name as string).trim(), symbol: getSymbolMeta(uc).symbol, active: true } satisfies CurrencyCatalogItem;
      });
    return entries.sort((a, b) => a.code.localeCompare(b.code));
  }

  return [];
}

/** Fetch catalog: v2 first, v1 fallback */
export async function fetchCurrencyCatalog(signal?: AbortSignal): Promise<CurrencyCatalogItem[]> {
  // Try v2
  try {
    const resp = await frankfurterFetch(`${V2_BASE}/currencies`, signal);
    if (resp.ok) {
      const raw = await resp.json();
      const items = normalizeCurrencyCatalogResponse(raw);
      if (items.length > 0) return items;
    }
    // If v2 returned non-ok but not 404, throw
    if (resp.status !== 404) {
      throw classifyHttpError(resp.status, FRANKFURTER_PROVIDER_ID);
    }
  } catch (err) {
    if (err instanceof ExchangeRateError && err.type === 'aborted') throw err;
    // Fall through to v1
  }

  // v1 fallback
  const resp = await frankfurterFetch(`${V1_BASE}/currencies`, signal);
  if (!resp.ok) throw classifyHttpError(resp.status, FRANKFURTER_PROVIDER_ID);
  const raw = await resp.json();
  const items = normalizeCurrencyCatalogResponse(raw);
  if (items.length === 0) {
    throw new ExchangeRateError({
      type: 'invalid_response',
      message: 'Catalog response is empty',
      safeMessage: ERROR_SAFE_MESSAGES.invalid_response,
      providerId: FRANKFURTER_PROVIDER_ID,
    });
  }
  return items;
}

/* ══════════════════════════════════════
   Frankfurter Provider (free, no API key)
   Phase 1.2: Quote uses base/symbols params
   ══════════════════════════════════════ */

export const frankfurterProvider: ExchangeRateProvider = {
  id: FRANKFURTER_PROVIDER_ID,
  label: 'Frankfurter',
  description: 'Official financial data aggregator',

  async getSupportedCurrencies(signal?: AbortSignal) {
    const items = await fetchCurrencyCatalog(signal);
    return items.map((item) => ({
      code: item.code,
      displayName: item.name,
      symbol: item.symbol,
      decimalDigits: getSymbolMeta(item.code).decimalDigits,
    }));
  },

  async getLatestRates(baseCurrency: string, signal?: AbortSignal) {
    try {
      const resp = await frankfurterFetch(
        `${V1_BASE}/latest?base=${encodeURIComponent(baseCurrency)}`,
        signal,
      );
      if (!resp.ok) throw classifyHttpError(resp.status, FRANKFURTER_PROVIDER_ID);
      const data = (await resp.json()) as { base: string; rates: Record<string, number>; date?: string };
      for (const [code, rate] of Object.entries(data.rates)) {
        normalizeRate(rate, FRANKFURTER_PROVIDER_ID, data.base, code);
      }
      const rateUpdatedAt = data.date ? new Date(data.date).getTime() : undefined;
      return { base: data.base, rates: data.rates, fetchedAt: Date.now(), rateUpdatedAt, providerId: FRANKFURTER_PROVIDER_ID };
    } catch (err) {
      throw classifyFetchError(err, FRANKFURTER_PROVIDER_ID);
    }
  },

  async getQuote(base: string, quote: string, signal?: AbortSignal) {
    if (base === quote) {
      return { base, quote, rate: 1, inverseRate: 1, fetchedAt: Date.now(), providerId: FRANKFURTER_PROVIDER_ID };
    }
    try {
      const url = `${V1_BASE}/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
      const resp = await frankfurterFetch(url, signal);
      if (!resp.ok) throw classifyHttpError(resp.status, FRANKFURTER_PROVIDER_ID);
      const data = (await resp.json()) as { base: string; rates: Record<string, number>; date?: string };
      const rawRate = data.rates?.[quote];
      const rate = normalizeRate(rawRate, FRANKFURTER_PROVIDER_ID, base, quote);
      const rateUpdatedAt = data.date ? new Date(data.date).getTime() : undefined;
      return {
        base, quote, rate,
        inverseRate: parseFloat((1 / rate).toFixed(6)),
        fetchedAt: Date.now(),
        rateUpdatedAt,
        providerId: FRANKFURTER_PROVIDER_ID,
      };
    } catch (err) {
      throw classifyFetchError(err, FRANKFURTER_PROVIDER_ID);
    }
  },
};

/* ══════════════════════════════════════
   Mock Provider
   ══════════════════════════════════════ */

const MOCK_CURRENCIES: [string, string][] = [
  ['CNY', 'Chinese Renminbi Yuan'], ['USD', 'US Dollar'], ['EUR', 'Euro'],
  ['JPY', 'Japanese Yen'], ['GBP', 'British Pound'], ['HKD', 'Hong Kong Dollar'],
  ['TWD', 'New Taiwan Dollar'], ['KRW', 'South Korean Won'], ['AUD', 'Australian Dollar'],
  ['CAD', 'Canadian Dollar'], ['SGD', 'Singapore Dollar'], ['CHF', 'Swiss Franc'],
  ['THB', 'Thai Baht'], ['INR', 'Indian Rupee'],
];

const MOCK_RATES: Record<string, number> = {
  CNY: 7.25, USD: 1.0, EUR: 0.92, JPY: 149.5, GBP: 0.79,
  HKD: 7.82, TWD: 32.1, KRW: 1345.0, AUD: 1.54, CAD: 1.37,
  SGD: 1.34, CHF: 0.89, THB: 36.2, INR: 83.5,
};

export const mockExchangeRateProvider: ExchangeRateProvider = {
  id: 'mock',
  label: 'Mock (offline)',

  async getSupportedCurrencies() {
    return MOCK_CURRENCIES.map(([code, name]) => toCurrencyInfo(code, name));
  },

  async getLatestRates(baseCurrency: string) {
    const baseRate = MOCK_RATES[baseCurrency];
    if (baseRate === undefined) throw new ExchangeRateError({ type: 'invalid_pair', message: `Unsupported: ${baseCurrency}`, safeMessage: ERROR_SAFE_MESSAGES.invalid_pair, providerId: 'mock' });
    const rates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(MOCK_RATES)) { rates[code] = parseFloat((rate / baseRate).toFixed(6)); }
    return { base: baseCurrency, rates, fetchedAt: Date.now(), providerId: 'mock' };
  },

  async getQuote(base: string, quote: string) {
    if (base === quote) return { base, quote, rate: 1, inverseRate: 1, fetchedAt: Date.now(), providerId: 'mock' };
    const r1 = MOCK_RATES[base], r2 = MOCK_RATES[quote];
    if (r1 === undefined || r2 === undefined) throw new ExchangeRateError({ type: 'invalid_pair', message: `Unsupported: ${base}/${quote}`, safeMessage: ERROR_SAFE_MESSAGES.invalid_pair, providerId: 'mock' });
    const rate = parseFloat((r2 / r1).toFixed(6));
    return { base, quote, rate, inverseRate: parseFloat((1 / rate).toFixed(6)), fetchedAt: Date.now(), providerId: 'mock' };
  },
};

export const defaultExchangeRateProvider: ExchangeRateProvider = frankfurterProvider;

export function isReal503(err: unknown): boolean {
  return err instanceof ExchangeRateError && err.type === 'provider_unavailable' && err.httpStatus === 503;
}
