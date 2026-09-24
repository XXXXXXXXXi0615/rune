/**
 * Life Utility Phase C — Exchange initial pair contract + search contract.
 *
 * The utility must never open on an unsupported pair: valid last-used → valid persisted
 * recent preference → neutral fallback. Canonical owners are untouched (store + provider).
 */
import { describe, expect, it } from 'vitest';
import {
  EXCHANGE_FALLBACK_SOURCE,
  EXCHANGE_FALLBACK_TARGET,
  isSupportedCurrency,
  isSupportedPair,
  resolveSourceCurrency,
  resolveTargetCurrency,
} from './exchangePair';
import { currencyMatchesQuery } from './exchangeSearch';

const CATALOG = ['TWD', 'USD', 'CNY', 'EUR', 'JPY', 'HKD'];

describe('Exchange initial pair (Phase C)', () => {
  it('keeps a valid last-used pair untouched', () => {
    expect(resolveSourceCurrency(['CNY', 'USD'], CATALOG)).toBe('CNY');
    expect(isSupportedPair('CNY', 'USD', CATALOG)).toBe(true);
    expect(resolveTargetCurrency('CNY', ['USD'], CATALOG)).toBe('USD');
  });

  it('falls back to a persisted recent preference when the stored code is unsupported', () => {
    expect(resolveSourceCurrency(['XXX', 'TWD', 'USD'], CATALOG)).toBe('TWD');
    expect(resolveSourceCurrency([null, undefined, 'EUR'], CATALOG)).toBe('EUR');
  });

  it('falls back to a neutral pair when nothing persisted is valid', () => {
    expect(resolveSourceCurrency(['XXX', null], CATALOG)).toBe(EXCHANGE_FALLBACK_SOURCE);
    expect(resolveTargetCurrency('XXX2', ['YYY'], CATALOG)).toBe(EXCHANGE_FALLBACK_TARGET);
    expect(isSupportedCurrency('XXX', CATALOG)).toBe(false);
    expect(isSupportedCurrency(null, CATALOG)).toBe(false);
  });

  it('never resolves a target equal to the source', () => {
    expect(resolveTargetCurrency('USD', ['USD'], CATALOG)).toBe(EXCHANGE_FALLBACK_SOURCE);
    expect(resolveTargetCurrency('TWD', [], CATALOG)).toBe('USD');
    expect(resolveTargetCurrency('TWD', [], ['TWD', 'EUR'])).toBe('EUR');
  });
});

describe('Exchange currency search (Phase C alias fix)', () => {
  const cny = { code: 'CNY', displayName: '人民幣', symbol: '¥' };

  it('finds CNY by its English alias regardless of code casing', () => {
    expect(currencyMatchesQuery(cny, 'yuan')).toBe(true);
    expect(currencyMatchesQuery(cny, 'renminbi')).toBe(true);
    expect(currencyMatchesQuery(cny, 'RMB')).toBe(true);
    expect(currencyMatchesQuery(cny, 'nope')).toBe(false);
  });

  it('still matches code, Chinese name and symbol', () => {
    expect(currencyMatchesQuery(cny, 'cny')).toBe(true);
    expect(currencyMatchesQuery(cny, '人民')).toBe(true);
    expect(currencyMatchesQuery(cny, '¥')).toBe(true);
    expect(currencyMatchesQuery(cny, '   ')).toBe(true);
  });
});
