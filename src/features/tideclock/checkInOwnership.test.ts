/**
 * Life Utility Phase A — check-in / streak / reward ownership closure.
 *
 * Canonical owner: `useCheckInStore` (persist `lunartide-check-in` v1).
 * The legacy `useAppStore.tideCheckIn` writers are fenced and must stay unreachable
 * from active source; Daily Status reads the canonical streak. See
 * docs/reports/life-utility-phase-a-ownership-closure.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCheckInStore } from './useCheckInStore';
import { buildCheckInIdempotencyKey, calculatePerfectStreak } from './tideclockEngine';
import { toLocalDateString } from '@/utils/date';
import { useAppStore } from '@/store/useAppStore';

const FENCED_LEGACY_WRITERS = ['checkInToday', 'addTidePoints', 'spendTidePoints', 'grantPlayroomMoonDew'];
const LEGACY_MIRROR_WRITERS_FILE = 'src/store/useAppStore.ts';

// These two audits walk the whole `src` tree and read every source file. They
// were running the walk twice and re-reading overlapping files, which pushed
// them past Vitest's 5s default. Memoize the walk and the reads: the second
// audit (`src/components` + `src/pages`) is then almost entirely cache hits.
const sourceFileCache = new Map<string, string[]>();
const sourceContentCache = new Map<string, string>();

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  const cached = sourceFileCache.get(dir);
  if (cached) {
    acc.push(...cached);
    return acc;
  }
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, found);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  sourceFileCache.set(dir, found);
  acc.push(...found);
  return acc;
}

function readSource(file: string): string {
  const cached = sourceContentCache.get(file);
  if (cached !== undefined) return cached;
  const content = readFileSync(file, 'utf8');
  sourceContentCache.set(file, content);
  return content;
}

const checkInLedgerEntries = () =>
  (useAppStore.getState().moonDewLedger || []).filter((entry) => entry.source === 'check_in');

describe('Life Utility Phase A — check-in canonical ownership', () => {
  beforeEach(() => {
    localStorage.clear();
    useCheckInStore.setState({ records: [], corrections: [], settlements: [], dismissedTodayDate: null });
    useAppStore.setState({ moonDewLedger: [] });
  });

  it('declares useCheckInStore as the single active check-in owner', () => {
    const options = useCheckInStore.persist.getOptions();
    expect(options.name).toBe('lunartide-check-in');
    expect(options.version).toBe(1);

    const state = useCheckInStore.getState();
    for (const action of ['clockIn', 'clockOut', 'getTodayStatus', 'getCurrentPerfectStreak', 'markMissed', 'submitMakeup']) {
      expect(typeof (state as unknown as Record<string, unknown>)[action]).toBe('function');
    }
  });

  it('clock-in writes 月露 once through the canonical ledger key', () => {
    const record = useCheckInStore.getState().clockIn();
    expect(record).not.toBeNull();

    const entries = checkInLedgerEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBeGreaterThanOrEqual(1);
    expect(entries[0].amount).toBeLessThanOrEqual(3);
    expect(entries[0].idempotencyKey).toBe(buildCheckInIdempotencyKey(record!.date, 'clock_in'));
    expect(record!.moonDewAwarded).toBe(entries[0].amount);

    // Canonical streak (live store) agrees with the reporting selector.
    expect(useCheckInStore.getState().getCurrentPerfectStreak()).toBe(1);
    expect(calculatePerfectStreak(useCheckInStore.getState().records, new Date())).toBe(1);
  });

  it('a repeated check-in on the same day does not double grant', () => {
    expect(useCheckInStore.getState().clockIn()).not.toBeNull();
    expect(checkInLedgerEntries()).toHaveLength(1);

    expect(useCheckInStore.getState().clockIn()).toBeNull();
    expect(useCheckInStore.getState().clockIn()).toBeNull();
    expect(checkInLedgerEntries()).toHaveLength(1);
    expect(useCheckInStore.getState().records).toHaveLength(1);
  });

  it('reporting streak reads canonical records (no legacy mirror read)', () => {
    const records = useCheckInStore.getState().records;
    expect(useCheckInStore.getState().getCurrentPerfectStreak()).toBe(calculatePerfectStreak(records, new Date()));
    const source = readFileSync('src/components/home/DailyTideFloatingWindow.tsx', 'utf8');
    expect(source).toContain('getCurrentPerfectStreak');
    expect(source).not.toMatch(/tideCheckIn|currentStreak/);
  });

  // A whole-`src` audit is I/O-bound by nature: even fully memoized, the first
  // pass has to read every source file once. The 5s default was never a
  // realistic budget for it, so these two carry an explicit one.
  it('keeps legacy tideCheckIn writers unreachable from active source', () => {
    const files = collectSourceFiles('src');
    // Guard: an audit that passes because it found no files is worthless. This
    // catches a memoization regression in collectSourceFiles just as hard as a
    // real offender. Measured: src has ~950 source files; the threshold keeps
    // ~50% headroom without becoming brittle.
    expect(files.length).toBeGreaterThan(500);
    const offenders = files
      .filter((file) => file !== LEGACY_MIRROR_WRITERS_FILE)
      .filter((file) => FENCED_LEGACY_WRITERS.some((writer) => new RegExp(`\\b${writer}\\s*\\(`).test(readSource(file))));
    expect(offenders).toEqual([]);
  }, 30_000);

  it('keeps presentation surfaces free of legacy tideCheckIn reads', () => {
    const surfaceFiles = [
      ...collectSourceFiles('src/components'),
      ...collectSourceFiles('src/pages'),
    ];
    // Measured: src/components + src/pages is ~474 files.
    expect(surfaceFiles.length).toBeGreaterThan(200);
    const offenders = surfaceFiles.filter((file) => /tideCheckIn/.test(readSource(file)));
    expect(offenders).toEqual([]);
  }, 30_000);

  it('keeps moonDewLedger persistence unchanged (canonical reward ledger)', () => {
    const entry = { amount: 2, source: 'manual_adjustment' as const, reasonCode: 'phase-a-test', title: 'ownership', idempotencyKey: `phase-a:${Date.now()}` };
    expect(useAppStore.getState().addMoonDewEntry(entry)).toBe(true);

    const persisted = JSON.parse(localStorage.getItem('lunartide_data') || '{}');
    expect(useAppStore.persist.getOptions().name).toBe('lunartide_data');
    expect(persisted.state?.moonDewLedger?.some((item: { idempotencyKey: string }) => item.idempotencyKey === entry.idempotencyKey)).toBe(true);
    expect(toLocalDateString(new Date())).toHaveLength(10);
  });
});
