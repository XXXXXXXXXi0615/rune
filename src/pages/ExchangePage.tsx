/**
 * Exchange (換匯) — Life Utility Phase C standalone utility page.
 *
 * Extraction only: the UI is `src/features/exchange/CurrencyExchange` and every
 * canonical owner stays where it was — rates/provider in `useExchangeRateStore`
 * (persist `lunartide_exchange_rates_v2`) + `exchangeRateProvider`. This page hosts
 * the tool and adds no feature of its own (no history / favorites / charts / diary).
 * Legacy `/ledger?tab=exchange` redirects here (`LegacyLedgerRedirect` in `src/App.tsx`).
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageBackButton } from '@/components/ui/PageBackButton';
import { CurrencyExchange } from '@/features/exchange/CurrencyExchange';
import '@/styles/tide-ledger-tokens.css';
import '@/features/exchange/exchange.css';
import './ExchangePage.css';

export function ExchangePage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    document.title = '換匯 · Exchange';
    document.body.classList.add('exchange-page-active');
    return () => document.body.classList.remove('exchange-page-active');
  }, []);

  return (
    <main className="exchange-page" data-testid="exchange-page">
      <header className="exchange-page__header">
        <PageBackButton to={returnTo || '/'} label="返回" />
        <div className="exchange-page__title">
          <span className="exchange-page__eyebrow">TIDE UTILITY</span>
          <h1>換匯</h1>
          <p>即時匯率換算</p>
        </div>
      </header>
      <div className="exchange-page__body">
        <CurrencyExchange />
      </div>
    </main>
  );
}
