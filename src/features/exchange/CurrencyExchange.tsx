import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useExchangeRateStore, decimalMultiply } from '@/store/useExchangeRateStore';
import type { CurrencyInfo } from '@/utils/exchangeRateProvider';
import { ExchangeRateError, isReal503 } from '@/utils/exchangeRateProvider';
import { usePetStore } from '@/store/usePetStore';
import { isSupportedCurrency, isSupportedPair, resolveSourceCurrency, resolveTargetCurrency } from './exchangePair';
import { currencyMatchesQuery } from './exchangeSearch';

/* ══════════════════════════════════════
   Currency Selector — Phase 1.2
   ══════════════════════════════════════ */

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF'];

function CurrencySelector({
  value, currencies, favorites, recents, catalogState, onChange, onToggleFavorite, label, title,
}: {
  value: string; currencies: CurrencyInfo[]; favorites: string[]; recents: string[];
  catalogState: 'idle' | 'loading' | 'ready' | 'error';
  onChange: (code: string) => void; onToggleFavorite: (code: string) => void;
  label: string; title: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const selected = useMemo(() => currencies.find((c) => c.code === value), [currencies, value]);

  // Filter: code, Chinese name, English alias, symbol. Case-insensitive.
  const filtered = useMemo(
    () => currencies.filter((c) => currencyMatchesQuery(c, query)),
    [currencies, query],
  );

  const favoriteCurrencies = useMemo(
    () => currencies.filter((c) => favorites.includes(c.code)),
    [currencies, favorites],
  );
  const recentCurrencies = useMemo(
    () => currencies.filter((c) => recents.includes(c.code) && c.code !== value),
    [currencies, recents, value],
  );
  const commonCurrencies = useMemo(
    () => currencies.filter((c) => COMMON_CURRENCIES.includes(c.code) && !favorites.includes(c.code) && !recents.includes(c.code)),
    [currencies, favorites, recents],
  );

  // "全部貨幣" group excludes currencies already shown in favorites/recents/常用
  // to avoid rendering the same currency twice (which breaks strict-mode selectors
  // and confuses users).
  const allCurrencies = useMemo(() => {
    const shown = new Set<string>([
      ...favoriteCurrencies.map((c) => c.code),
      ...recentCurrencies.map((c) => c.code),
      ...commonCurrencies.map((c) => c.code),
    ]);
    return currencies.filter((c) => !shown.has(c.code));
  }, [currencies, favoriteCurrencies, recentCurrencies, commonCurrencies]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      // Ignore clicks inside the selector trigger AND inside the portaled dropdown
      // (the dropdown is rendered via createPortal to document.body, outside containerRef).
      if (containerRef.current?.contains(t)) return;
      if (overlayRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); containerRef.current?.querySelector('button')?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) { inputRef.current.focus(); setFocusedIdx(-1); setQuery(''); }
  }, [open]);

  const selectItem = useCallback((code: string) => {
    onChange(code); setOpen(false); setQuery('');
    containerRef.current?.querySelector('button')?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    const items = listRef.current?.querySelectorAll<HTMLElement>('.ex-currency-selector__option');
    if (!items || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, items.length - 1)); items[Math.min(focusedIdx + 1, items.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); items[Math.max(focusedIdx - 1, 0)]?.focus(); }
    else if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); const code = items[focusedIdx]?.dataset.code; if (code) selectItem(code); }
    else if (e.key === ' ') { e.preventDefault(); }
  }, [open, focusedIdx, selectItem]);

  const isEmpty = filtered.length === 0;

  return (
    <div className="ex-currency-selector" ref={containerRef} onKeyDown={handleKeyDown}>
      <button type="button" className="ex-currency-selector__trigger"
        onClick={() => { setOpen(true); }} aria-label={label} aria-expanded={open} aria-haspopup="listbox">
        <span className="ex-currency-selector__code">{selected?.code ?? value}</span>
        <span className="ex-currency-selector__name">{selected?.displayName ?? (catalogState === 'loading' ? '載入中…' : value)}</span>
        <svg className="ex-currency-selector__chevron" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && createPortal(
        <div className="ex-currency-selector__overlay" ref={overlayRef} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ex-currency-selector__dropdown" onClick={(e) => e.stopPropagation()} role="listbox" aria-label={title}>
            {/* Header with title */}
            <div className="ex-currency-selector__title-bar">
              <span className="ex-currency-selector__title-text">{title}</span>
              {selected && <span className="ex-currency-selector__current">{selected.symbol} {selected.code}</span>}
            </div>
            <div className="ex-currency-selector__search">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input ref={inputRef} type="text" className="ex-currency-selector__input" placeholder="搜尋代碼、名稱或符號…" value={query} onChange={(e) => { setQuery(e.target.value); setFocusedIdx(-1); }} />
            </div>

            <div className="ex-currency-selector__list" ref={listRef}>
              {/* Loading state */}
              {catalogState === 'loading' && (
                <div className="ex-currency-selector__state">正在取得可用貨幣…</div>
              )}

              {/* Error with no data */}
              {catalogState === 'error' && currencies.length === 0 && (
                <div className="ex-currency-selector__state ex-currency-selector__state--error">
                  <span>無法載入貨幣清單</span>
                  <button type="button" className="ex-currency-selector__retry" onClick={() => { useExchangeRateStore.getState().loadCurrencies(); }}>重試</button>
                </div>
              )}

              {/* Results */}
              {catalogState !== 'loading' && currencies.length > 0 && (
                <>
                  {!query.trim() ? (
                    <>
                      {favoriteCurrencies.length > 0 && (
                        <div className="ex-currency-selector__group">
                          <div className="ex-currency-selector__group-label">收藏</div>
                          {favoriteCurrencies.map((c) => (
                            <CurrencyOption key={c.code} currency={c} selected={c.code === value} favorites={favorites}
                              onSelect={selectItem} onToggleFavorite={onToggleFavorite} />
                          ))}
                        </div>
                      )}
                      {recentCurrencies.length > 0 && (
                        <div className="ex-currency-selector__group">
                          <div className="ex-currency-selector__group-label">最近使用</div>
                          {recentCurrencies.map((c) => (
                            <CurrencyOption key={c.code} currency={c} selected={c.code === value} favorites={favorites}
                              onSelect={selectItem} onToggleFavorite={onToggleFavorite} />
                          ))}
                        </div>
                      )}
                      {commonCurrencies.length > 0 && (
                        <div className="ex-currency-selector__group">
                          <div className="ex-currency-selector__group-label">常用貨幣</div>
                          {commonCurrencies.map((c) => (
                            <CurrencyOption key={c.code} currency={c} selected={c.code === value} favorites={favorites}
                              onSelect={selectItem} onToggleFavorite={onToggleFavorite} />
                          ))}
                        </div>
                      )}
                      <div className="ex-currency-selector__group">
                        <div className="ex-currency-selector__group-label">全部貨幣 ({allCurrencies.length})</div>
                        {allCurrencies.map((c) => (
                          <CurrencyOption key={c.code} currency={c} selected={c.code === value} favorites={favorites}
                            onSelect={selectItem} onToggleFavorite={onToggleFavorite} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {!isEmpty ? (
                        <div className="ex-currency-selector__group">
                          <div className="ex-currency-selector__group-label">搜尋結果 ({filtered.length})</div>
                          {filtered.map((c) => (
                            <CurrencyOption key={c.code} currency={c} selected={c.code === value} favorites={favorites}
                              onSelect={selectItem} onToggleFavorite={onToggleFavorite} />
                          ))}
                        </div>
                      ) : (
                        <div className="ex-currency-selector__state">
                          找不到「{query}」相關貨幣
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
}

function CurrencyOption({
  currency, selected, favorites, onSelect, onToggleFavorite,
}: {
  currency: CurrencyInfo; selected: boolean; favorites: string[];
  onSelect: (code: string) => void; onToggleFavorite: (code: string) => void;
}) {
  // Phase C: the option is an ARIA listbox option (not a nested <button> — the favorite
  // star must be the only button in the row, otherwise the DOM nests buttons).
  return (
    <div
      className={`ex-currency-selector__option${selected ? ' is-active' : ''}`}
      role="option"
      aria-selected={selected}
      data-code={currency.code}
      tabIndex={-1}
      onClick={() => onSelect(currency.code)}
    >
      <span className="ex-currency-selector__option-symbol">{currency.symbol}</span>
      <span className="ex-currency-selector__option-code">{currency.code}</span>
      <span className="ex-currency-selector__option-name">{currency.displayName}</span>
      {selected && <svg className="ex-currency-selector__checkmark" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>}
      <button type="button" className={`ex-currency-selector__star${favorites.includes(currency.code) ? ' is-active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(currency.code); }}
        aria-label={favorites.includes(currency.code) ? '取消收藏' : '加入收藏'}>
        {favorites.includes(currency.code) ? '★' : '☆'}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════
   Main CurrencyExchange — Phase 1.2
   ══════════════════════════════════════ */

export function CurrencyExchange() {

  const currencies = useExchangeRateStore((s) => s.currencies);
  const catalogState = useExchangeRateStore((s) => s.catalogState);
  const catalogStale = useExchangeRateStore((s) => s.catalogStale);
  const snapshot = useExchangeRateStore((s) => s.snapshot);
  const lastQuote = useExchangeRateStore((s) => s.lastQuote);
  const status = useExchangeRateStore((s) => s.status);
  const lastError = useExchangeRateStore((s) => s.lastError);
  const favoriteIds = useExchangeRateStore((s) => s.favoriteIds);
  const recentIds = useExchangeRateStore((s) => s.recentIds);
  const lastUsedSourceCurrency = useExchangeRateStore((s) => s.lastUsedSourceCurrency);
  const loadCurrencies = useExchangeRateStore((s) => s.loadCurrencies);
  const fetchRates = useExchangeRateStore((s) => s.fetchRates);
  const addFavorite = useExchangeRateStore((s) => s.addFavorite);
  const removeFavorite = useExchangeRateStore((s) => s.removeFavorite);
  const addRecent = useExchangeRateStore((s) => s.addRecent);
  const setLastUsedSourceCurrency = useExchangeRateStore((s) => s.setLastUsedSourceCurrency);

  const previewPetPresentation = usePetStore((s) => s.previewPresentation);
  const clearPreviewPresentation = usePetStore((s) => s.clearPreviewPresentation);

  const requestIdRef = useRef(crypto.randomUUID());
  // Rotate requestId on each fetch to prevent stale cleanup
  const bumpRequestId = useCallback(() => { requestIdRef.current = crypto.randomUUID(); }, []);

  const [amount, setAmountRaw] = useState('1');
  const [sourceCurrency, setSourceCurrency] = useState(lastUsedSourceCurrency);
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clawd503Active, setClawd503Active] = useState(false);

  const setAmount = useCallback((v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmountRaw(cleaned);
  }, []);

  const parsedAmount = useMemo(() => {
    if (!amount) return NaN;
    const n = parseFloat(amount);
    return isNaN(n) || !isFinite(n) || n < 0 ? NaN : n;
  }, [amount]);

  useEffect(() => { loadCurrencies(); }, [loadCurrencies]);

  const supportedCodes = useMemo(() => currencies.map((c) => c.code), [currencies]);

  // Phase C: never open on an unsupported pair. Once the catalog is known, a stored
  // code that is not in it is replaced by the priority chain
  // (valid last-used → valid recent preference → neutral fallback).
  useEffect(() => {
    if (supportedCodes.length === 0) return;
    const nextSource = isSupportedCurrency(sourceCurrency, supportedCodes)
      ? sourceCurrency
      : resolveSourceCurrency([lastUsedSourceCurrency, ...recentIds], supportedCodes);
    const nextTarget = isSupportedCurrency(targetCurrency, supportedCodes) && targetCurrency !== nextSource
      ? targetCurrency
      : resolveTargetCurrency(nextSource, [recentIds[0]], supportedCodes);
    if (nextSource === sourceCurrency && nextTarget === targetCurrency) return;
    setSourceCurrency(nextSource);
    setTargetCurrency(nextTarget);
    if (nextSource !== lastUsedSourceCurrency) setLastUsedSourceCurrency(nextSource);
  }, [supportedCodes, sourceCurrency, targetCurrency, lastUsedSourceCurrency, recentIds, setLastUsedSourceCurrency]);

  useEffect(() => {
    if (!isSupportedPair(sourceCurrency, targetCurrency, supportedCodes)) return;
    fetchRates(sourceCurrency, targetCurrency);
  }, [sourceCurrency, targetCurrency, supportedCodes, fetchRates]);

  // Rate computation
  const rate: number | null = useMemo(() => {
    if (sourceCurrency === targetCurrency) return 1;
    if (lastQuote && lastQuote.base === sourceCurrency && lastQuote.quote === targetCurrency) return lastQuote.rate;
    return snapshot?.rates?.[targetCurrency] ?? null;
  }, [snapshot, lastQuote, sourceCurrency, targetCurrency]);

  const inverseRate = useMemo(() => {
    if (rate === null || rate === 0) return null;
    return parseFloat((1 / rate).toFixed(6));
  }, [rate]);

  const result = useMemo(
    () => (!isNaN(parsedAmount) && rate !== null) ? decimalMultiply(parsedAmount, rate) : null,
    [parsedAmount, rate],
  );

  const targetMeta = useMemo(() => currencies.find((c) => c.code === targetCurrency), [currencies, targetCurrency]);
  const sourceMeta = useMemo(() => currencies.find((c) => c.code === sourceCurrency), [currencies, sourceCurrency]);

  const formatAmount = useCallback((value: number, meta?: CurrencyInfo) => {
    const digits = meta?.decimalDigits ?? 2;
    return value.toFixed(digits);
  }, []);

  const resultFormatted = useMemo(() => {
    if (result === null) return '—';
    const sym = targetMeta?.symbol ?? targetCurrency;
    return `${sym} ${formatAmount(result, targetMeta)}`;
  }, [result, targetMeta, targetCurrency, formatAmount]);

  const rateFormatted = useMemo(() => {
    if (!rate) return '—';
    const digits = Math.max(4, sourceMeta?.decimalDigits ?? 2);
    return `1 ${sourceCurrency} = ${rate.toFixed(digits)} ${targetCurrency}`;
  }, [rate, sourceCurrency, targetCurrency, sourceMeta]);

  const inverseFormatted = useMemo(() => {
    if (!inverseRate) return '';
    const digits = Math.max(4, targetMeta?.decimalDigits ?? 2);
    return `1 ${targetCurrency} = ${inverseRate.toFixed(digits)} ${sourceCurrency}`;
  }, [inverseRate, sourceCurrency, targetCurrency, targetMeta]);

  const handleSwap = useCallback(() => {
    setSourceCurrency(targetCurrency);
    setTargetCurrency(sourceCurrency);
  }, [sourceCurrency, targetCurrency]);

  const handleSourceChange = useCallback((code: string) => {
    if (code === sourceCurrency) return;
    setSourceCurrency(code);
    setLastUsedSourceCurrency(code);
    addRecent(code);
  }, [sourceCurrency, setLastUsedSourceCurrency, addRecent]);

  const handleTargetChange = useCallback((code: string) => {
    if (code === targetCurrency) return;
    setTargetCurrency(code);
    addRecent(code);
  }, [targetCurrency, addRecent]);

  const handleToggleFavorite = useCallback((code: string) => {
    favoriteIds.includes(code) ? removeFavorite(code) : addFavorite(code);
  }, [favoriteIds, addFavorite, removeFavorite]);

  const handleCopy = useCallback(() => {
    if (resultFormatted === '—') return;
    navigator.clipboard.writeText(resultFormatted).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [resultFormatted]);

  const handleRefresh = useCallback(() => {
    if (!sourceCurrency) return;
    setRefreshing(true);
    fetchRates(sourceCurrency, targetCurrency);
  }, [sourceCurrency, targetCurrency, fetchRates]);

  useEffect(() => { if (status !== 'loading') setRefreshing(false); }, [status]);

  // CLAWD 503 lifecycle with ownership
  useEffect(() => {
    if (lastError && isReal503(lastError)) {
      bumpRequestId();
      previewPetPresentation('clawd', 'clawd-error-runtime', 5000, 'exchange', requestIdRef.current);
      setClawd503Active(true);
    }
  }, [lastError, previewPetPresentation, bumpRequestId]);

  // Clear CLAWD 503 on success — only clear Exchange-owned override
  useEffect(() => {
    if (clawd503Active && status === 'ready' && !lastError) {
      clearPreviewPresentation('clawd', 'exchange', requestIdRef.current);
      setClawd503Active(false);
    }
  }, [status, lastError, clawd503Active, clearPreviewPresentation]);

  // Clear CLAWD 503 on route leave — only clear Exchange-owned override
  useEffect(() => {
    return () => {
      if (clawd503Active) {
        clearPreviewPresentation('clawd', 'exchange', requestIdRef.current);
        setClawd503Active(false);
      }
    };
  }, [clawd503Active, clearPreviewPresentation]);

  const isLoading = status === 'loading';
  const hasError = status === 'error' && lastError !== null;
  const hasCache = snapshot !== null || lastQuote !== null;

  const fetchedAt = (lastQuote?.fetchedAt ?? snapshot?.fetchedAt ?? 0);
  const rateUpdatedAt = (lastQuote?.rateUpdatedAt ?? (snapshot as { rateUpdatedAt?: number })?.rateUpdatedAt);

  /** The authoritative date for freshness: rateUpdatedAt (provider's data date), fallback fetchedAt. */
  const freshnessTs = rateUpdatedAt || fetchedAt;
  const usesFallbackFreshness = !rateUpdatedAt; // true when using fetchedAt as proxy

  const cacheDateStr = useMemo(() => {
    if (!fetchedAt) return '';
    return new Date(fetchedAt).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  }, [fetchedAt]);

  const rateDateStr = useMemo(() => {
    if (!rateUpdatedAt) return '';
    return new Date(rateUpdatedAt).toLocaleString('zh-TW', { month: 'short', day: 'numeric' });
  }, [rateUpdatedAt]);

  // Freshness: ≤6h → 最新, 6–24h → 稍早, >24h → 過期
  // Uses rateUpdatedAt (provider date) as primary; falls back to fetchedAt.
  const freshnessLabel = useMemo(() => {
    if (!freshnessTs) return null;
    const ageMs = Date.now() - freshnessTs;
    const ageHours = ageMs / 3600_000;
    if (ageHours <= 6) return 'fresh';
    if (ageHours <= 24) return 'stale';
    return 'expired';
  }, [freshnessTs]);

  const freshnessText = useMemo(() => {
    if (!freshnessTs) return '';
    const ageMs = Date.now() - freshnessTs;
    const ageHours = Math.round(ageMs / 3600_000);
    if (ageHours <= 0) return '';
    return `${ageHours} 小時前`;
  }, [freshnessTs]);

  const providerLabel = 'Frankfurter';
  const providerDesc = 'Official financial data aggregator';

  const ariaLiveMsg = useMemo(() => {
    if (isLoading) return '正在取得匯率';
    if (resultFormatted !== '—') return `換算結果：${parsedAmount} ${sourceCurrency} 等於 ${resultFormatted}`;
    return '';
  }, [isLoading, resultFormatted, parsedAmount, sourceCurrency]);

  return (
    <div className="ex-layout" data-testid="exchange-layout">
      {/* Header */}
      <div className="ex-header">
        <div className="ex-header__info">
          <h2 className="ex-header__title">換匯計算機</h2>
          {cacheDateStr && (
            <span className="ex-header__updated">
              取得 {cacheDateStr}
              {rateDateStr && ` · 匯率日期 ${rateDateStr}`}
              {usesFallbackFreshness && freshnessLabel && <span className="ex-header__stale-badge">&nbsp;· 依取得時間估算</span>}
              {freshnessLabel === 'stale' && <span className="ex-header__stale-badge">&nbsp;· 稍早資料</span>}
              {freshnessLabel === 'expired' && <span className="ex-header__stale-badge">&nbsp;· 過期快取</span>}
              {catalogStale && <span className="ex-header__stale-badge">&nbsp;· 貨幣清單可能不是最新</span>}
            </span>
          )}
        </div>
        <button type="button" className={`ex-refresh-btn${refreshing ? ' is-spinning' : ''}`}
          onClick={handleRefresh} title="重新整理" aria-label="重新整理匯率" disabled={refreshing || isLoading}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>

      {/* Error compact bar */}
      {hasError && (
        <div className="ex-error-bar" role="alert">
          <span className="ex-error-bar__icon">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <span className="ex-error-bar__type">{lastError.safeMessage}</span>
          {hasCache && <span className="ex-error-bar__stale">顯示 {cacheDateStr} 的快取資料</span>}
          <button type="button" className="ex-error-bar__retry" onClick={handleRefresh}>重試</button>
        </div>
      )}

      {/* Catalog error while no currencies */}
      {catalogState === 'error' && currencies.length === 0 && !hasError && (
        <div className="ex-error-bar" role="alert">
          <span className="ex-error-bar__icon">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <span className="ex-error-bar__type">無法載入貨幣清單</span>
          <button type="button" className="ex-error-bar__retry" onClick={() => { useExchangeRateStore.getState().loadCurrencies(); }}>重試</button>
        </div>
      )}

      {/* Loading skeleton for initial load */}
      {catalogState === 'loading' && currencies.length === 0 && (
        <div className="ex-loading" aria-busy="true">載入貨幣列表中…</div>
      )}

      {/* Form + Result Layout */}
      <div className="ex-body">
        {/* Left: Form */}
        <div className="ex-form-col">
          <div className="ex-form__row">
            <label className="ex-form__label">金額</label>
            <input type="text" inputMode="decimal" className="ex-form__input"
              placeholder="輸入金額" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                const cleaned = pasted.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                if (cleaned && !isNaN(parseFloat(cleaned))) { e.preventDefault(); setAmountRaw(cleaned); }
              }}
              aria-label="金額" autoComplete="off"
            />
          </div>

          <div className="ex-pair">
            <div className="ex-pair__item">
              <label className="ex-form__label">來源</label>
              <CurrencySelector value={sourceCurrency} currencies={currencies}
                favorites={favoriteIds} recents={recentIds} catalogState={catalogState}
                onChange={handleSourceChange} onToggleFavorite={handleToggleFavorite}
                label="來源貨幣" title="選擇來源貨幣" />
            </div>
            <button type="button" className="ex-swap-btn" onClick={handleSwap} aria-label="交換貨幣">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m17 1 4 4-4 4" /><path d="M7 23l-4-4 4-4" /><path d="M21 5H10a7 7 0 0 0-7 7" /><path d="M3 19h11a7 7 0 0 0 7-7" /></svg>
            </button>
            <div className="ex-pair__item">
              <label className="ex-form__label">目標</label>
              <CurrencySelector value={targetCurrency} currencies={currencies}
                favorites={favoriteIds} recents={recentIds} catalogState={catalogState}
                onChange={handleTargetChange} onToggleFavorite={handleToggleFavorite}
                label="目標貨幣" title="選擇目標貨幣" />
            </div>
          </div>
        </div>

        {/* Right: Result */}
        <div className="ex-result-col">
          {isLoading && !hasCache ? (
            <div className="ex-result-skeleton">
              <div className="ex-skeleton-line ex-skeleton-line--lg" />
              <div className="ex-skeleton-line" />
              <div className="ex-skeleton-line ex-skeleton-line--sm" />
            </div>
          ) : result !== null ? (
            <div className="ex-result-card">
              <div className="ex-result-card__main">
                <span className="ex-result-card__label">換算結果</span>
                <span className="ex-result-card__value" aria-live="polite">{resultFormatted}</span>
                <button type="button" className="ex-result-card__copy" onClick={handleCopy} aria-label={copied ? '已複製' : '複製結果'}>
                  {copied ? (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  )}
                </button>
              </div>
              <div className="ex-result-card__meta">
                <span className="ex-result-card__rate">{rateFormatted}</span>
                {inverseFormatted && <span className="ex-result-card__inverse">{inverseFormatted}</span>}
              </div>
              <div className="ex-result-card__footer">
                <span>{providerLabel}</span>
                <span className="ex-result-card__desc">{providerDesc}</span>
                {freshnessLabel === 'fresh' && !hasError && <span className="ex-badge ex-badge--fresh">最新匯率</span>}
                {freshnessLabel === 'stale' && !hasError && <span className="ex-badge ex-badge--stale">稍早資料</span>}
                {freshnessLabel === 'expired' && !hasError && <span className="ex-badge ex-badge--stale">過期快取</span>}
                {freshnessLabel === 'expired' && hasError && hasCache && <span className="ex-badge ex-badge--stale">使用快取匯率{freshnessText && ` · ${freshnessText}`}</span>}
                {status === 'ready' && freshnessLabel === 'fresh' && !hasError && <span className="sr-only">即時匯率</span>}
              </div>
            </div>
          ) : amount === '' ? (
            <div className="ex-placeholder">請輸入金額</div>
          ) : isNaN(parsedAmount) ? (
            <div className="ex-placeholder ex-placeholder--warn">請輸入有效金額</div>
          ) : (
            <div className="ex-placeholder">選擇貨幣組合以查看匯率</div>
          )}
        </div>
      </div>

      <div className="sr-only" aria-live="polite">{ariaLiveMsg}</div>
    </div>
  );
}
